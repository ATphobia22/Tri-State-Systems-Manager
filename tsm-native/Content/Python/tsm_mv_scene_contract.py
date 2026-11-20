"""Headless, standard-library-only validation for Mount Vernon UE-local GIS scenes.

No source transform, vertical datum or survey precision is inferred here.
An external GIS conversion must produce the declared UE_LOCAL_CM coordinates.
The validation intentionally rejects ambiguous coordinates and partial files.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
from pathlib import Path

SCHEMA = "tsm.mount-vernon.scene.v1"
ROLES = ("buildings", "roads", "trees")
TYPES = {"buildings": "Polygon", "roads": "LineString", "trees": "Point"}
SAFE_FILE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]*\.geojson$")
SAFE_ID = re.compile(r"^[A-Za-z0-9_.:-]{1,110}$")
MAX_UE_CM = 1_000_000.0  # 10 km from the origin, not a guarantee of survey precision


class SceneError(ValueError):
    """Fail with a clear evidence/geometry reason before spawning any actors."""


def sha256_file(path: Path) -> str:
    checksum = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1048576), b""):
            checksum.update(chunk)
    return checksum.hexdigest()


def _xy(vertex, role):
    if not isinstance(vertex, (list, tuple)) or len(vertex) not in (2, 3):
        raise SceneError(f"{role}: coordinate must have 2 or 3 entries")
    if not all(isinstance(x, (int, float)) and not isinstance(x, bool)
               and math.isfinite(x) for x in vertex):
        raise SceneError(f"{role}: non-finite or nonnumeric coordinate")
    if any(abs(x) > MAX_UE_CM for x in vertex):
        raise SceneError(f"{role}: local coordinate exceeds 10 km bound")
    return tuple(float(x) for x in vertex)


def _validate_feature(feature, role):
    if not isinstance(feature, dict) or feature.get("type") != "Feature":
        raise SceneError(f"{role}: expected GeoJSON Feature")
    geometry = feature.get("geometry") or {}
    if geometry.get("type") != TYPES[role]:
        raise SceneError(f"{role}: required geometry {TYPES[role]}")
    props = feature.get("properties") or {}
    uid = str(props.get("id", ""))
    if not SAFE_ID.fullmatch(uid):
        raise SceneError(f"{role}: missing/unsafe stable feature id")
    coords = geometry.get("coordinates")
    if role == "buildings":
        if not isinstance(coords, list) or len(coords) != 1:
            raise SceneError("buildings: only simple single-ring polygons supported; split holes/multipolygons upstream")
        points = [_xy(p, role) for p in coords[0]]
        if len(points) < 4 or points[0][:2] != points[-1][:2]:
            raise SceneError(f"buildings {uid}: ring must have at least 3 vertices and be closed")
        if len({p[:2] for p in points[:-1]}) < 3:
            raise SceneError(f"buildings {uid}: degenerate polygon")
    elif role == "roads":
        if not isinstance(coords, list):
            raise SceneError(f"roads {uid}: expected line")
        points = [_xy(p, role) for p in coords]
        if len(points) < 2 or len({p[:2] for p in points}) < 2:
            raise SceneError(f"roads {uid}: insufficient distinct vertices")
    else:
        points = [_xy(coords, role)]
    for key in ("height_cm", "eave_cm", "width_cm"):
        if key in props:
            value = props[key]
            if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value) or value < 0:
                raise SceneError(f"{role} {uid}: invalid {key}")
    if role == "buildings" and props.get("height_cm", 0) and props.get("eave_cm", 0):
        if props["eave_cm"] > props["height_cm"]:
            raise SceneError(f"buildings {uid}: eave exceeds roof ridge")
    return {"id": uid, "points": points, "properties": props, "closed": role == "buildings"}


def load_scene(scene_dir):
    """Return validated (manifest, layers); checksum every layer before use.

    Manifest requires source CRS and local-grid orientation and an evidence status;
    it never upgrades PENDING_EVIDENCE to authoritative on its own.
    """
    root = Path(scene_dir).expanduser().resolve(strict=True)
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    return manifest, validate_scene(root, manifest)


def validate_scene(root: Path, manifest: dict):
    """Validate candidate metadata and the exact bytes parsed for each layer."""
    if not isinstance(manifest, dict):
        raise SceneError("manifest: expected a JSON object")
    if manifest.get("schema") != SCHEMA:
        raise SceneError("manifest: schema must be " + SCHEMA)
    if manifest.get("coordinate_frame") != "UE_LOCAL_CM" or manifest.get("axes") != "EAST_SOUTH_UP":
        raise SceneError("manifest: expected UE_LOCAL_CM / EAST_SOUTH_UP")
    crs = str(manifest.get("source_horizontal_crs", ""))
    if not re.fullmatch(r"EPSG:\d{4,6}", crs):
        raise SceneError("manifest: explicit source_horizontal_crs EPSG code required")
    if manifest.get("vertical_datum") not in ("NAVD88_REVIEW_PENDING", "UNVERIFIED", "NAVD88_REVIEWED"):
        raise SceneError("manifest: vertical_datum must disclose review state")
    if manifest.get("evidence_status") not in ("PENDING_EVIDENCE", "SOURCE_REVIEWED"):
        raise SceneError("manifest: evidence_status must be PENDING_EVIDENCE or SOURCE_REVIEWED")
    anchor = manifest.get("source_anchor") or {}
    for key in ("easting", "northing"):
        value = anchor.get(key)
        if type(value) not in (float, int) or not math.isfinite(value):
            raise SceneError(f"manifest: source_anchor.{key} is required")
    if anchor.get("units") not in ("us_survey_foot", "meter"):
        raise SceneError("manifest: source_anchor.units must be explicit")
    assets = manifest.get("files") or {}
    if set(assets) != set(ROLES):
        raise SceneError("manifest: files must map buildings, roads, trees")
    layers = {}
    for role in ROLES:
        entry = assets[role]
        if not isinstance(entry, dict):
            raise SceneError(f"manifest: invalid {role} asset")
        filename = entry.get("path", "")
        checksum = entry.get("sha256", "")
        if not isinstance(filename, str) or not SAFE_FILE.fullmatch(filename):
            raise SceneError(f"manifest: unsafe {role} filename")
        if not isinstance(checksum, str) or not re.fullmatch(r"[0-9a-f]{64}", checksum):
            raise SceneError(f"manifest: invalid {role} SHA-256")
        path = (root / filename).resolve(strict=True)
        if path.parent != root:
            raise SceneError(f"manifest: {role} file must remain within scene folder")
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != checksum:
            raise SceneError(f"{role}: SHA-256 mismatch")
        fc = json.loads(raw)
        if not isinstance(fc, dict) or fc.get("type") != "FeatureCollection" or not isinstance(fc.get("features"), list):
            raise SceneError(f"{role}: expected GeoJSON FeatureCollection")
        seen = set()
        features = []
        for feat in fc["features"]:
            item = _validate_feature(feat, role)
            if item["id"] in seen:
                raise SceneError(f"{role}: duplicate id {item['id']}")
            seen.add(item["id"])
            features.append(item)
        layers[role] = sorted(features, key=lambda x: x["id"])
    return layers


def scene_summary(scene_dir):
    manifest, layers = load_scene(scene_dir)
    return {
        "schema": SCHEMA,
        "source_horizontal_crs": manifest["source_horizontal_crs"],
        "vertical_datum": manifest["vertical_datum"],
        "evidence_status": manifest["evidence_status"],
        "counts": {role: len(layers[role]) for role in ROLES},
        "manifest_sha256": sha256_file(Path(scene_dir) / "manifest.json"),
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scene_dir", help="Folder containing manifest.json and three GeoJSON files")
    args = parser.parse_args()
    print(json.dumps(scene_summary(args.scene_dir), indent=2, sort_keys=True))
