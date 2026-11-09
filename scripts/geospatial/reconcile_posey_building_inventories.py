#!/usr/bin/env python3
"""Reconcile two Posey GeoJSON inventories by OBJECTID and exact geometry digest.

No CRS, survey, height, or vertical-datum equivalence is inferred.
Exit 0 only for identical identity sets and geometry; exit 1 for differences.
"""
import argparse
import hashlib
import json
from pathlib import Path


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()


def load(path):
    raw = path.read_bytes()
    doc = json.loads(raw)
    if doc.get("type") != "FeatureCollection" or not isinstance(doc.get("features"), list):
        raise ValueError(f"{path}: expected FeatureCollection")
    index = {}
    duplicates = []
    missing = 0
    for feature in doc["features"]:
        props = feature.get("properties") or {}
        oid = props.get("OBJECTID", props.get("objectid"))
        if isinstance(oid, bool) or not isinstance(oid, int):
            missing += 1
            continue
        if oid in index:
            duplicates.append(oid)
        geometry = feature.get("geometry")
        index[oid] = sha256(canonical(geometry))
    return {
        "path": str(path),
        "file_sha256": sha256(raw),
        "feature_count": len(doc["features"]),
        "unique_objectids": len(index),
        "missing_objectid_count": missing,
        "duplicate_objectids": sorted(set(duplicates)),
        "root_crs": doc.get("crs"),
    }, index


def reconcile(left_path, right_path):
    left, a = load(left_path)
    right, b = load(right_path)
    shared = set(a) & set(b)
    changed = sorted(oid for oid in shared if a[oid] != b[oid])
    only_left = sorted(set(a) - set(b))
    only_right = sorted(set(b) - set(a))
    equivalent = not (only_left or only_right or changed or
                      left["missing_objectid_count"] or right["missing_objectid_count"] or
                      left["duplicate_objectids"] or right["duplicate_objectids"])
    return {
        "schema": "tsm.posey-objectid-geometry-reconciliation.v1",
        "comparison": "exact GeoJSON geometry JSON canonical digest; no topology tolerance or CRS transformation",
        "left": left, "right": right,
        "common_objectids": len(shared),
        "changed_geometry_objectids": changed,
        "left_only_objectids": only_left,
        "right_only_objectids": only_right,
        "equivalent_identity_and_geometry": equivalent,
        "survey_certified": False,
        "height_verified": False,
        "datum_verified": False,
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--left", required=True, type=Path)
    p.add_argument("--right", required=True, type=Path)
    p.add_argument("--out", required=True, type=Path)
    args = p.parse_args()
    result = reconcile(args.left, args.right)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    raw = canonical(result) + b"\n"
    args.out.write_bytes(raw)
    args.out.with_suffix(args.out.suffix + ".sha256").write_text(sha256(raw) + "  " + args.out.name + "\n")
    print(json.dumps({"equivalent": result["equivalent_identity_and_geometry"],
                      "common": result["common_objectids"],
                      "changed": len(result["changed_geometry_objectids"]),
                      "left_only": len(result["left_only_objectids"]),
                      "right_only": len(result["right_only_objectids"])}))
    raise SystemExit(0 if result["equivalent_identity_and_geometry"] else 1)


if __name__ == "__main__":
    main()
