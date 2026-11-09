#!/usr/bin/env python3
"""Verify, inventory and checksum a built Mount Vernon *web reference* city scene.

This manifest binds the official-source scene receipt to the actual distributable
viewer bytes; it never asserts a surveyed city, verified heights, native package,
or calibrated flood result. No dependencies outside Python's standard library.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

HEX = re.compile(r"^[0-9a-f]{64}$")
BUILDINGS = "https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0"
ROADS = "https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_2024/FeatureServer/0"
MAX_SCENE_BYTES = 42_000_000
MAX_FILES = 20_000
MANIFEST_NAME = "mount-vernon-deployment.manifest.json"


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def read_json(path: Path, max_bytes: int) -> dict:
    if not path.is_file() or path.is_symlink():
        raise ValueError(f"MISSING_OR_SYMLINK_FILE: {path}")
    with path.open("rb") as f:
        raw = f.read(max_bytes + 1)
    if len(raw) > max_bytes:
        raise ValueError(f"OVERSIZED_FILE: {path}")
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError(f"INVALID_JSON_OBJECT: {path}")
    return value


def verify_scene(root: Path) -> dict:
    archive = root / "scene.json"
    if not archive.is_file() or archive.is_symlink():
        raise ValueError("SCENE_MISSING")
    raw = archive.read_bytes()
    if not 0 < len(raw) <= MAX_SCENE_BYTES:
        raise ValueError("SCENE_SIZE_INVALID")
    receipt = read_json(root / "scene.receipt.json", 128_000)
    scene = json.loads(raw)
    if not isinstance(scene, dict):
        raise ValueError("SCENE_NOT_OBJECT")
    if receipt.get("schema") != "tsm.mount-vernon-city-receipt.v1":
        raise ValueError("RECEIPT_SCHEMA_INVALID")
    if receipt.get("sha256") != sha(raw) or receipt.get("byte_length") != len(raw):
        raise ValueError("SCENE_RECEIPT_HASH_MISMATCH")
    if receipt.get("review") != "NOT_EVIDENCED" or receipt.get("regulatory_approval") is not False:
        raise ValueError("UNSUPPORTED_APPROVAL_ASSERTION")
    if scene.get("schema") != "tsm.mount-vernon-city-scene.v1" or scene.get("crs") != "EPSG:4326":
        raise ValueError("SCENE_SCHEMA_OR_CRS_INVALID")
    if scene.get("accuracy_claim") != "REFERENCE_ONLY_NOT_SURVEY_OR_ENGINEERING":
        raise ValueError("SCENE_ACCURACY_ASSERTION_INVALID")
    if scene.get("vertical_datum") != "NOT_ESTABLISHED_FOR_GEOMETRY":
        raise ValueError("VERTICAL_DATUM_UNSUPPORTED")
    if scene.get("terrain", {}).get("height_datum") != "MUST_BE_VERIFIED_SEPARATELY":
        raise ValueError("TERRAIN_DATUM_UNSUPPORTED")
    sources = scene.get("sources")
    if not isinstance(sources, dict):
        raise ValueError("SOURCE_REGISTRY_INVALID")
    counts = {}
    for layer, kind, url, allowed_types in [
        ("buildings", "building", BUILDINGS, ("Polygon", "MultiPolygon")),
        ("roads", "road", ROADS, ("LineString", "MultiLineString")),
    ]:
        evidence = sources.get(layer)
        collection = scene.get(layer)
        if not isinstance(evidence, dict) or evidence.get("layer_url") != url:
            raise ValueError(f"UNEXPECTED_SOURCE_URL: {layer}")
        if evidence.get("output_crs") != "EPSG:4326":
            raise ValueError(f"SOURCE_CRS_INVALID: {layer}")
        if not isinstance(collection, dict) or collection.get("type") != "FeatureCollection":
            raise ValueError(f"INVALID_FEATURE_COLLECTION: {layer}")
        features = collection.get("features")
        if not isinstance(features, list) or len(features) > 100_000:
            raise ValueError(f"INVALID_FEATURE_COUNT: {layer}")
        if (evidence.get("source_object_count") != len(features)
                or receipt.get("feature_counts", {}).get(layer) != len(features)):
            raise ValueError(f"COUNT_DISAGREEMENT: {layer}")
        seen = set()
        for item in features:
            if not isinstance(item, dict) or item.get("type") != "Feature":
                raise ValueError(f"INVALID_FEATURE: {layer}")
            p = item.get("properties")
            geometry = item.get("geometry")
            if not isinstance(p, dict) or not isinstance(geometry, dict):
                raise ValueError(f"INVALID_PROPERTIES_OR_GEOMETRY: {layer}")
            oid = p.get("source_objectid")
            expected = f"IGIO:{kind}:{oid}"
            if (type(oid) is not int or oid < 0 or oid in seen
                    or item.get("id") != expected or p.get("tsm_id") != expected):
                raise ValueError(f"DUPLICATE_OR_INVALID_IDENTITY: {layer}")
            seen.add(oid)
            if (p.get("source_url") != url or p.get("kind") != kind
                    or p.get("engineering_approved") is not False
                    or p.get("height_m", "MISSING") is not None
                    or p.get("height_status") != "NOT_EVIDENCED"
                    or p.get("evidence_status") != "SOURCE_OBSERVED_UNREVIEWED"):
                raise ValueError(f"UNSUPPORTED_ENGINEERING_PROPERTY: {layer}")
            if geometry.get("type") not in allowed_types:
                raise ValueError(f"INVALID_GEOMETRY_TYPE: {layer}")
            feature_hash = p.get("source_feature_sha256")
            if not isinstance(feature_hash, str) or not HEX.fullmatch(feature_hash):
                raise ValueError(f"FEATURE_HASH_INVALID: {layer}")
        counts[layer] = len(features)
    return {"scene_sha256": sha(raw), "scene_bytes": len(raw), "counts": counts}


def inventory(root: Path) -> list[dict]:
    if not root.is_dir() or root.is_symlink():
        raise ValueError("VIEWER_DIRECTORY_INVALID")
    paths = sorted(root.rglob("*"))
    if len(paths) > MAX_FILES:
        raise ValueError("TOO_MANY_VIEWER_FILES")
    records = []
    for path in paths:
        if path.is_symlink():
            raise ValueError(f"SYMLINK_IN_VIEWER: {path}")
        if path.is_dir():
            continue
        if not path.is_file():
            raise ValueError(f"NONREGULAR_VIEWER_FILE: {path}")
        relative = path.relative_to(root).as_posix()
        if relative == MANIFEST_NAME:
            continue
        raw = path.read_bytes()
        records.append({"path": relative, "bytes": len(raw), "sha256": sha(raw)})
    if not any(item["path"] == "index.html" and item["bytes"] for item in records):
        raise ValueError("VIEWER_INDEX_MISSING")
    if not any(item["path"].startswith("assets/") and item["path"].endswith(".js") for item in records):
        raise ValueError("VIEWER_JAVASCRIPT_MISSING")
    return records


def assemble(root: Path) -> dict:
    expected = verify_scene(root / "mount-vernon-scene")
    files = inventory(root)
    lookup = {f["path"]: f for f in files}
    for name in ("scene.json", "scene.receipt.json"):
        if f"mount-vernon-scene/{name}" not in lookup:
            raise ValueError(f"UNSTAGED_CITY_ARCHIVE: {name}")
    if lookup["mount-vernon-scene/scene.json"]["sha256"] != expected["scene_sha256"]:
        raise ValueError("ARCHIVE_CHANGED_DURING_INVENTORY")
    return {
        "schema": "tsm.mount-vernon-viewer-deployment.v1",
        "product": "MOUNT_VERNON_WEB_REFERENCE_SCENE",
        "site": "Mount Vernon, Indiana",
        "scope": "OFFICIAL_PLANIMETRIC_CONTEXT_ONLY",
        "native_windows_shipping_verified": False,
        "terrain_vertical_datum_verified": False,
        "survey_certified": False,
        "hydraulics_calibrated": False,
        "official_source_republication_authenticated": False,
        "scene": expected,
        "files": files,
    }


def verify_manifest(root: Path) -> dict:
    actual = assemble(root)
    saved = read_json(root / MANIFEST_NAME, 5_000_000)
    if saved != actual:
        raise ValueError("VIEWER_DEPLOYMENT_MANIFEST_MISMATCH")
    return saved


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--viewer-dir", type=Path, required=True, help="Compiled Vite dist directory")
    p.add_argument("--verify", action="store_true", help="Validate an existing immutable manifest")
    args = p.parse_args()
    root = args.viewer_dir
    if args.verify:
        value = verify_manifest(root)
    else:
        value = assemble(root)
        output = root / MANIFEST_NAME
        output.write_text(json.dumps(value, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"verified": True, "scope": value["scope"], "scene": value["scene"],
                      "asset_count": len(value["files"]), "manifest": str(root / MANIFEST_NAME)},
                     sort_keys=True))


if __name__ == "__main__":
    main()
