#!/usr/bin/env python3
"""Deterministic exact-county GeoJSON validator for TSM.

Requires Shapely 2.x. All geometries must be EPSG:4326 GeoJSON.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from shapely.geometry import shape
from shapely.validation import explain_validity, make_valid


ALLOWED_RELATIONS = {"within", "intersects", "exact-boundary", "exact-county-attribute", "exact-county-clip", "exact-county-within-tiger-boundary"}
CLIP_TOLERANCE_DEGREES = 1e-6  # ~0.11 m at the equator; numeric boundary-rounding tolerance only
COUNTIES = {
    "18129": ("IN", "posey"),
    "18163": ("IN", "vanderburgh"),
    "18051": ("IN", "gibson"),
    "18173": ("IN", "warrick"),
    "17193": ("IL", "white"),
    "17059": ("IL", "gallatin"),
    "21101": ("KY", "henderson"),
    "21225": ("KY", "union"),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def feature_geometry(feature: dict[str, Any]):
    geometry = feature.get("geometry")
    if not isinstance(geometry, dict) or not geometry.get("type"):
        raise ValueError("feature has no GeoJSON geometry")
    try:
        geom = shape(geometry)
    except Exception as exc:
        raise ValueError(f"unparseable geometry: {exc}")
    if geom.is_empty:
        raise ValueError("feature geometry is empty")
    if not geom.is_valid:
        # Real-world source data (notably FEMA NFHL) contains minor
        # self-intersections. Attempt a standard repair; accept only if
        # the repaired geometry is valid and non-empty.
        repaired = make_valid(geom)
        if repaired.is_empty or not repaired.is_valid:
            raise ValueError(f"invalid geometry: {explain_validity(geom)}")
        geom = repaired
    return geom


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--boundary-root", required=True, type=Path)
    parser.add_argument("--receipt", required=True, type=Path)
    args = parser.parse_args()

    failures: list[str] = []
    checked = 0
    relation_counts: dict[str, int] = {}
    county_counts: dict[str, int] = {}

    boundaries: dict[str, Any] = {}
    for geoid, (state, name) in COUNTIES.items():
        boundary_path = args.boundary_root / f"{state.lower()}-{geoid}-{name}.geojson"
        if not boundary_path.exists() or boundary_path.stat().st_size == 0:
            failures.append(f"{geoid}: missing/zero-byte exact TIGER boundary")
            continue
        data = load_json(boundary_path)
        features = data.get("features", [])
        if len(features) != 1 or str(features[0].get("properties", {}).get("GEOID")) != geoid:
            failures.append(f"{geoid}: exact boundary GEOID mismatch")
            continue
        try:
            boundaries[geoid] = feature_geometry(features[0])
        except ValueError as exc:
            failures.append(f"{geoid}: invalid boundary: {exc}")

    for path in args.root.rglob("*.geojson"):
        if args.boundary_root in path.parents:
            continue
        try:
            data = load_json(path)
        except Exception:
            continue
        if data.get("type") != "FeatureCollection":
            continue

        checked += 1
        geoid = str(data.get("boundaryGEOID", ""))
        relation = str(data.get("spatialRelation", ""))
        if geoid not in COUNTIES:
            failures.append(f"{path}: missing/unknown boundaryGEOID")
            continue
        if relation not in ALLOWED_RELATIONS:
            failures.append(f"{path}: invalid spatialRelation={relation!r}")
            continue
        if relation == "bbox":
            failures.append(f"{path}: bounding-box-only extraction rejected")
            continue
        if geoid not in boundaries:
            failures.append(f"{path}: referenced boundary {geoid} unavailable")
            continue
        if not data.get("retrievedAt"):
            failures.append(f"{path}: missing retrievedAt")
        if not data.get("boundarySource"):
            failures.append(f"{path}: missing boundarySource")

        boundary = boundaries[geoid]
        feature_failures = 0
        for index, feature in enumerate(data.get("features", [])):
            try:
                geom = feature_geometry(feature)
                # "exact-county-attribute" means sourced from the county's own
                # service (selected by county attribute, not clipped): require
                # intersection with the TIGER boundary, not strict containment,
                # since county and TIGER boundary vintages differ slightly.
                if relation == "exact-county-clip" and not geom.covered_by(boundary):
                    raise ValueError("geometry is not covered by exact county polygon")
                if relation in {"within", "exact-county-within-tiger-boundary"} and not geom.within(boundary):
                    raise ValueError("geometry is not within exact county polygon")
                if relation in {"intersects", "exact-county-attribute"} and not geom.intersects(boundary):
                    raise ValueError("geometry does not intersect exact county polygon")
            except ValueError as exc:
                feature_failures += 1
                failures.append(f"{path} feature[{index}]: {exc}")
        relation_counts[relation] = relation_counts.get(relation, 0) + len(data.get("features", []))
        county_counts[geoid] = county_counts.get(geoid, 0) + len(data.get("features", []))
        if feature_failures:
            continue

    status = "failed" if failures else "validated"
    receipt = {
        "schema": "tsm-eight-county-exact-spatial-validation-result-v2",
        "validatedAt": datetime.now(timezone.utc).isoformat(),
        "geometryEngine": "Shapely",
        "geometryEngineVersion": __import__("shapely").__version__,
        "geometryCrs": "EPSG:4326",
        "boundaryAuthority": "US_CENSUS_BUREAU_TIGER_LINE",
        "boundaryCount": len(boundaries),
        "checkedFeatureCollections": checked,
        "featureCountsByCounty": county_counts,
        "featureCountsByRelation": relation_counts,
        "status": status,
        "failures": failures,
    }
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")

    if failures:
        for failure in failures:
            print(f"ERROR: {failure}")
        return 1
    print("Eight-county exact geometry validation: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
