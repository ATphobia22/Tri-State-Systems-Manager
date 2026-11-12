#!/usr/bin/env python3
"""Validate offline GIS batch manifests without inventing missing source evidence."""
import argparse
import hashlib
import json
import math
from pathlib import Path

def audit(root: Path, require_parcels=False):
    findings = []
    checked = 0
    for manifest_path in sorted(root.rglob("layer-manifest.json")):
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        target = manifest.get("target_crs")
        if target != "EPSG:2966":
            findings.append(f"{manifest_path}: unexpected target CRS {target!r}")
        if manifest.get("vertical_datum") != "NOT_APPLICABLE":
            findings.append(f"{manifest_path}: parcel geometries must not claim a vertical datum")
        if manifest.get("format") != "TSM_PROJECTED_FEATURE_COLLECTION_V1":
            findings.append(f"{manifest_path}: projected feature collection format not declared")
        seen = set()
        count = 0
        for batch in manifest.get("batches", []):
            filename = batch.get("file", "")
            if not filename or Path(filename).name != filename or not filename.endswith(".epsg2966.json"):
                findings.append(f"{manifest_path}: unsafe batch filename {filename!r}")
                continue
            path = manifest_path.parent / filename
            if not path.is_file():
                findings.append(f"{path}: missing")
                continue
            payload = path.read_bytes()
            if hashlib.sha256(payload).hexdigest() != batch.get("sha256"):
                findings.append(f"{path}: checksum mismatch")
                continue
            data = json.loads(payload)
            features = data.get("features", [])
            if len(features) != batch.get("features"):
                findings.append(f"{path}: feature count mismatch")
            for feature in features:
                oid = feature.get("properties", {}).get("objectid")
                if oid is None or oid in seen:
                    findings.append(f"{path}: missing or duplicate objectid {oid!r}")
                seen.add(oid)
                if str(feature.get("properties", {}).get("county_fips")) != "18129":
                    findings.append(f"{path}: unexpected county")
                geometry = feature.get("geometry") or {}
                if geometry.get("type") not in ("Polygon", "MultiPolygon"):
                    findings.append(f"{path}: unsupported parcel geometry")
            count += len(features)
            checked += 1
        if count != manifest.get("total_features"):
            findings.append(f"{manifest_path}: total feature count mismatch")
        if count == 0:
            findings.append(f"{manifest_path}: no features")
    if require_parcels and checked == 0:
        findings.append("No offline parcel layer manifest found")
    return {"status": "PASS" if not findings else "FAIL", "checked_batches": checked, "findings": findings}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--require-parcels", action="store_true")
    args = parser.parse_args()
    result = audit(args.root, args.require_parcels)
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["status"] == "PASS" else 1)

if __name__ == "__main__":
    main()
