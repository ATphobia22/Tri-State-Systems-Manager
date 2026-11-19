"""Pure-Python, headless evidence contract for Mount Vernon UE editor exports.

Data are ALREADY in Unreal-local centimeters (X east, Y south, Z up).
This module performs no geodetic transform or vertical datum assumption.
"""
from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path

SCHEMA = "tsm.mount-vernon.editor-package.v1"
AXES = "X_EAST_Y_SOUTH_Z_UP"
MAX_LOCAL_CM = 2_000_000_000  # bounded float-position input; not a precision guarantee
VALID_KINDS = {"building", "road", "tree"}


@dataclass(frozen=True)
class Feature:
    kind: str
    feature_id: str
    points: tuple[tuple[float, float, float], ...]
    closed: bool
    properties: dict
    source_sha256: str

    @property
    def stable_label(self) -> str:
        key = (self.kind + "\0" + self.feature_id).encode("utf-8")
        return "TSM_MV_" + self.kind.upper() + "_" + hashlib.sha256(key).hexdigest()[:16]


def _require(condition: bool, message: str):
    if not condition:
        raise ValueError(message)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _number(value, label: str) -> float:
    _require(type(value) in (int, float), label + ": expected number")
    result = float(value)
    _require(math.isfinite(result) and abs(result) <= MAX_LOCAL_CM,
             label + ": nonfinite/out-of-range centimeter coordinate")
    return result


def _points(raw, props: dict, context: str):
    _require(isinstance(raw, list) and len(raw) > 0, context + ": empty coordinates")
    z_fallback = props.get("ground_z_cm")
    converted = []
    for i, p in enumerate(raw):
        _require(isinstance(p, (list, tuple)) and len(p) in (2, 3),
                 context + ": expected 2D/3D vertex")
        _require(len(p) == 3 or z_fallback is not None,
                 context + ": 2D vertices require explicit ground_z_cm")
        z = p[2] if len(p) == 3 else z_fallback
        converted.append((_number(p[0], context + ".x"),
                          _number(p[1], context + ".y"),
                          _number(z, context + ".z")))
    return tuple(converted)


def _geometries(kind: str, geom: dict, props: dict, context: str):
    t = geom.get("type")
    coords = geom.get("coordinates")
    if kind == "building":
        if t == "Polygon":
            polys = [coords]
        elif t == "MultiPolygon":
            polys = coords
        else:
            raise ValueError(context + ": buildings require Polygon/MultiPolygon")
        _require(isinstance(polys, list) and len(polys) > 0, context + ": empty polygons")
        for poly in polys:
            _require(isinstance(poly, list) and len(poly) == 1,
                     context + ": polygon holes require explicit mesh triangulation; not silently dropped")
            vertices = _points(poly[0], props, context)
            _require(len(vertices) >= 4 and vertices[0] == vertices[-1],
                     context + ": polygon ring must be explicitly closed")
            _require(len(set(vertices[:-1])) >= 3, context + ": degenerate polygon")
            yield vertices[:-1], True
    elif kind == "road":
        if t == "LineString":
            lines = [coords]
        elif t == "MultiLineString":
            lines = coords
        else:
            raise ValueError(context + ": roads require LineString/MultiLineString")
        _require(isinstance(lines, list) and len(lines) > 0, context + ": empty roads")
        for line in lines:
            vertices = _points(line, props, context)
            _require(len(vertices) >= 2, context + ": road needs >=2 vertices")
            yield vertices, False
    else:
        _require(t == "Point", context + ": tree requires Point")
        yield _points([coords], props, context), False


def inspect_package(path: str | Path):
    manifest_path = Path(path).expanduser().resolve(strict=True)
    _require(manifest_path.is_file(), "manifest must be a file")
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    _require(data.get("schema_version") == SCHEMA, "unsupported package schema")
    frame = data.get("coordinate_frame")
    _require(isinstance(frame, dict), "coordinate_frame is required")
    _require(frame.get("space") == "LOCAL_UNREAL_CM" and frame.get("axes") == AXES,
             "GeoJSON must already be explicitly transformed to local Unreal centimeters")
    _require(isinstance(frame.get("horizontal_crs"), str) and frame["horizontal_crs"].startswith("EPSG:"),
             "horizontal source CRS is required")
    _require(frame.get("vertical_datum") not in (None, "", "ASSUMED_NAVD88"),
             "record vertical datum as verified source value or UNVERIFIED, never assume NAVD88")
    _require(frame.get("vertical_units") not in (None, ""),
             "source vertical units must be recorded; use UNVERIFIED if unknown")
    _require(isinstance(frame.get("origin"), dict), "survey origin metadata is required")
    for key in ("easting", "northing", "elevation"):
        _number(frame["origin"].get(key), "origin." + key)
    _require(frame["origin"].get("unit") in ("us-ft", "meter"),
             "origin unit must be us-ft or meter")
    scene = data.get("scene", {})
    _require(isinstance(scene, dict) and
             isinstance(scene.get("world_partition_map"), str) and
             scene["world_partition_map"].startswith("/Game/"),
             "scene.world_partition_map must name a saved Unreal map")
    _require(scene.get("evidence_status") in ("PENDING_EVIDENCE", "INPUTS_REVIEWED"),
             "explicit evidence status required")
    datasets = data.get("datasets")
    _require(isinstance(datasets, list) and 1 <= len(datasets) <= 3, "provide 1-3 vector datasets")
    seen_kinds, seen_ids, features, sources = set(), set(), [], []
    root = manifest_path.parent
    for dataset in datasets:
        kind = dataset.get("kind")
        _require(kind in VALID_KINDS and kind not in seen_kinds, "invalid/duplicate dataset kind")
        seen_kinds.add(kind)
        rel = dataset.get("path")
        _require(isinstance(rel, str) and rel and not Path(rel).is_absolute(),
                 "dataset path must be relative to manifest directory")
        source_path = (root / rel).resolve(strict=True)
        _require(source_path.is_relative_to(root) and source_path.is_file(),
                 "dataset escapes package root or is missing: " + rel)
        expected = dataset.get("sha256", "").lower()
        _require(len(expected) == 64 and all(c in "0123456789abcdef" for c in expected),
                 "required lowercase SHA-256 for " + rel)
        actual = sha256_file(source_path)
        _require(actual == expected, "SHA-256 mismatch: " + rel)
        _require(dataset.get("source_crs") == frame["horizontal_crs"],
                 "dataset CRS does not match coordinate frame")
        _require(isinstance(dataset.get("source_uri"), str) and dataset["source_uri"],
                 "missing provenance source_uri")
        raw = json.loads(source_path.read_text(encoding="utf-8"))
        _require(raw.get("type") == "FeatureCollection" and isinstance(raw.get("features"), list),
                 "expected GeoJSON FeatureCollection: " + rel)
        if "expected_feature_count" in dataset:
            _require(len(raw["features"]) == dataset["expected_feature_count"],
                     "source feature count mismatch: " + rel)
        for index, feature in enumerate(raw["features"]):
            ctx = kind + "[" + str(index) + "]"
            _require(feature.get("type") == "Feature", ctx + ": invalid GeoJSON Feature")
            props = feature.get("properties") or {}
            _require(isinstance(props, dict), ctx + ": properties must be object")
            fid = props.get("source_id")
            _require(isinstance(fid, (str, int)) and str(fid).strip(),
                     ctx + ": stable source_id required")
            key = (kind, str(fid))
            _require(key not in seen_ids, ctx + ": duplicate source_id")
            seen_ids.add(key)
            _require(isinstance(feature.get("geometry"), dict), ctx + ": missing geometry")
            for part, (points, closed) in enumerate(_geometries(kind, feature["geometry"], props, ctx)):
                part_id = str(fid) + (":" + str(part) if part else "")
                features.append(Feature(kind, part_id, points, closed, props, actual))
        sources.append({"kind": kind, "path": rel, "sha256": actual,
                        "count": len(raw["features"]), "source_uri": dataset["source_uri"]})
    labels = [f.stable_label for f in features]
    _require(len(labels) == len(set(labels)), "stable label collision; inspect IDs")
    return {"manifest_path": str(manifest_path), "manifest_sha256": sha256_file(manifest_path),
            "frame": frame, "scene": scene, "sources": sources, "features": features}
