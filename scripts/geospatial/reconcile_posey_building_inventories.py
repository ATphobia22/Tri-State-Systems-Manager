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


ID_ALIASES = ("igioObjectId", "OBJECTID", "objectid")


def declared_crs(doc):
    """Honor GeoJSON WGS84 default, but reject conflicting explicit CRS claims."""
    fields = []
    if doc.get("geometryCrs") is not None:
        fields.append(doc["geometryCrs"])
    root = doc.get("crs")
    if root is not None:
        if isinstance(root, dict) and root.get("type") == "name":
            root = (root.get("properties") or {}).get("name")
        fields.append(root)
    if not fields:
        return "EPSG:4326", True
    if not all(isinstance(x, str) and x.startswith("EPSG:") for x in fields):
        return None, False
    return fields[0], len(set(fields)) == 1


def extract_objectid(props):
    values = [props[k] for k in ID_ALIASES if k in props]
    if not values:
        return None, False
    # Disallow bool, floats and strings: a source ID must be an exact integer.
    if any(isinstance(x, bool) or not isinstance(x, int) or x < 0 for x in values):
        return None, True
    if len(set(values)) > 1:
        return None, True
    return values[0], False


def load(path):
    raw = path.read_bytes()
    doc = json.loads(raw)
    if doc.get("type") != "FeatureCollection" or not isinstance(doc.get("features"), list):
        raise ValueError(f"{path}: expected FeatureCollection")
    index = {}
    duplicates = []
    missing = 0
    conflicting = 0
    for feature in doc["features"]:
        props = feature.get("properties") or {}
        oid, conflict = extract_objectid(props)
        if conflict:
            conflicting += 1
            continue
        if oid is None:
            missing += 1
            continue
        if oid in index:
            duplicates.append(oid)
        geometry = feature.get("geometry")
        index[oid] = sha256(canonical(geometry))
    crs, crs_consistent = declared_crs(doc)
    return {
        "path": str(path),
        "resolved_crs": crs,
        "crs_metadata_consistent": crs_consistent,
        "conflicting_identity_count": conflicting,
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
    crs_compatible = (
        left["crs_metadata_consistent"] and right["crs_metadata_consistent"]
        and left["resolved_crs"] is not None
        and left["resolved_crs"] == right["resolved_crs"]
    )
    equivalent = not (only_left or only_right or changed or
                      left["missing_objectid_count"] or right["missing_objectid_count"] or
                      left["conflicting_identity_count"] or right["conflicting_identity_count"] or
                      left["duplicate_objectids"] or right["duplicate_objectids"]) and crs_compatible
    return {
        "schema": "tsm.posey-objectid-geometry-reconciliation.v1",
        "comparison": "exact GeoJSON geometry JSON canonical digest; no topology tolerance or CRS transformation",
        "left": left, "right": right,
        "crs_compatible": crs_compatible,
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
