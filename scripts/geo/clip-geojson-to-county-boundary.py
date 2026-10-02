#!/usr/bin/env python3
"""Filter county-derived GeoJSON features to an authoritative TIGER boundary."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.validation import make_valid


def valid_geometry(geometry):
    if geometry.is_empty:
        return geometry
    if not geometry.is_valid:
        geometry = make_valid(geometry)
    return geometry


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--geojson", required=True, type=Path)
    parser.add_argument("--boundary", required=True, type=Path)
    args = parser.parse_args()

    data = json.loads(args.geojson.read_text(encoding="utf-8-sig"))
    boundary_data = json.loads(args.boundary.read_text(encoding="utf-8-sig"))
    if len(boundary_data.get("features", [])) != 1:
        raise ValueError("Boundary must contain exactly one feature")
    boundary = valid_geometry(shape(boundary_data["features"][0]["geometry"]))

    features = []
    excluded = 0
    for feature in data.get("features", []):
        geometry = valid_geometry(shape(feature["geometry"]))
        if geometry.is_empty or not geometry.within(boundary):
            excluded += 1
            continue
        retained = dict(feature)
        retained["geometry"] = mapping(geometry)
        features.append(retained)

    data["features"] = features
    data["spatialRelation"] = "exact-county-within-tiger-boundary"
    data["boundaryPolicy"] = "exact-county-within-tiger-boundary"
    data["filterMethod"] = "strict native-geometry containment within authoritative TIGER boundary"
    data["filterBoundary"] = args.boundary.as_posix()
    data["excludedOutsideBoundaryFeatureCount"] = excluded
    args.geojson.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Strict county filter {args.geojson}: retained={len(features)} excluded={excluded}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
