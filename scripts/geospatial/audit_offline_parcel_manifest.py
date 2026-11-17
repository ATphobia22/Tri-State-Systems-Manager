#!/usr/bin/env python3
"""Validate offline GIS batch manifests without inventing missing source evidence."""
import argparse
import hashlib
import json
import math
from pathlib import Path

def inspect_projected_polygon(geometry: dict) -> str | None:
    """Non-mutating EPSG:2966 planar topology audit; never returns replacement geometry.

    Candidate make_valid output is only diagnostic. The source boundary must remain
    unchanged pending independent survey/regulatory review.
    """
    from shapely import make_valid
    from shapely.geometry import shape
    from shapely.errors import GEOSException
    from shapely.validation import explain_validity

    try:
        # Reject malformed source rings *before* Shapely normalizes/auto-closes them.
        kind = geometry.get("type")
        if kind not in ("Polygon", "MultiPolygon"):
            return f"unsupported source geometry type {kind!r}"
        groups = [geometry.get("coordinates")] if kind == "Polygon" else geometry.get("coordinates")
        if not isinstance(groups, (list, tuple)) or not groups:
            return "missing polygon coordinate groups"
        for polygon_rings in groups:
            if not isinstance(polygon_rings, (list, tuple)) or not polygon_rings:
                return "missing exterior ring"
            for ring in polygon_rings:
                if not isinstance(ring, (list, tuple)) or len(ring) < 4:
                    return "polygon ring has fewer than four coordinates"
                for position in ring:
                    if (not isinstance(position, (list, tuple)) or len(position) != 2
                            or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in position)):
                        return "polygon ring must contain finite horizontal x/y pairs"
                if ring[0] != ring[-1]:
                    return "source polygon ring is not explicitly closed (Shapely auto-closure forbidden)"
                if len({(point[0], point[1]) for point in ring}) < 3:
                    return "polygon ring has fewer than three distinct vertices"
        polygon = shape(geometry)
        if polygon.geom_type not in ("Polygon", "MultiPolygon"):
            return f"unexpected Shapely geometry type {polygon.geom_type}"
        if polygon.is_empty or not all(math.isfinite(v) for v in polygon.bounds):
            return "empty or non-finite projected geometry"
        if not math.isfinite(polygon.area):
            return "non-finite projected area (ftUS squared)"
        if not polygon.is_valid:
            candidate = make_valid(polygon)
            # Zero-area bow-tie sources cannot have a meaningful fractional delta.
            delta = ((candidate.area - polygon.area) / polygon.area
                     if polygon.area > 0 else None)
            delta_text = f"{delta:.9g}" if delta is not None else "undefined_zero_source_area"
            return (
                f"invalid source topology: {explain_validity(polygon)}; "
                f"make_valid is review-only; candidate_type={candidate.geom_type}, "
                f"candidate_area_delta_fraction={delta_text}"
            )
        if polygon.area <= 0:
            return "zero projected area (ftUS squared)"
        return None
    except (ValueError, TypeError, AttributeError, OverflowError, KeyError, GEOSException) as exc:
        return f"unparseable projected geometry: {type(exc).__name__}: {exc}"


def audit(root: Path, require_parcels=False, check_geometry=False):
    findings = []
    checked = 0
    topology_checked = 0
    topology_invalid = 0
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
                if check_geometry and target == "EPSG:2966":
                    topology_checked += 1
                    issue = inspect_projected_polygon(geometry)
                    if issue:
                        topology_invalid += 1
                        findings.append(f"{path}: objectid {oid!r}: {issue}")
            count += len(features)
            checked += 1
        if count != manifest.get("total_features"):
            findings.append(f"{manifest_path}: total feature count mismatch")
        if count == 0:
            findings.append(f"{manifest_path}: no features")
    if require_parcels and checked == 0:
        findings.append("No offline parcel layer manifest found")
    return {"status": "PASS" if not findings else "FAIL", "checked_batches": checked, "geometry_quality": "CHECKED" if topology_checked else "NOT_RUN", "geometry_checked": topology_checked, "geometry_invalid": topology_invalid, "findings": findings}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--require-parcels", action="store_true")
    parser.add_argument("--check-geometry", action="store_true", help="Check projected parcel topology; never auto-repair official geometry")
    args = parser.parse_args()
    result = audit(args.root, args.require_parcels, args.check_geometry)
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["status"] == "PASS" else 1)

if __name__ == "__main__":
    main()
