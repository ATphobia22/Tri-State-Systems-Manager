#!/usr/bin/env python3
"""Clip county-derived GeoJSON features to an authoritative TIGER boundary."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.ops import unary_union
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
    boundary = unary_union(
        [shape(feature["geometry"]) for feature in boundary_data["features"]]
    )

    features = []
    for feature in data.get("features", []):
        geometry = valid_geometry(shape(feature["geometry"]))
        if geometry.is_empty or not geometry.intersects(boundary):
            continue
        clipped = valid_geometry(geometry.intersection(boundary))
        if clipped.is_empty:
            continue
        clipped_feature = dict(feature)
        clipped_feature["geometry"] = mapping(clipped)
        features.append(clipped_feature)

    data["features"] = features
    data["spatialRelation"] = "exact-county-clip"
    data["boundaryPolicy"] = "exact-county-clip"
    data["clipMethod"] = "Shapely intersection with authoritative TIGER boundary"
    data["clipBoundary"] = args.boundary.as_posix()
    args.geojson.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Clipped {args.geojson}: {len(features)} features")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
