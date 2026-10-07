#!/usr/bin/env python3
"""Derive building heights from classified Indiana 3DEP QL2 LAS.

Method follows the 2026 USGS evaluation pattern: use building/roof returns
(class 6), robustly summarize roof elevation inside each authoritative IGIO
footprint, and subtract the authoritative NAVD88 ground elevation already
joined to the footprint. Missing/insufficient roof observations are errors;
no synthetic storey or fixed-height fallback is permitted.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import laspy
import numpy as np
from pyproj import Transformer
from shapely.geometry import Point, shape
from shapely.strtree import STRtree
from shapely.ops import transform


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--geojson", required=True, type=Path)
    ap.add_argument("--las", action="append", required=True, type=Path)
    ap.add_argument("--output", required=True, type=Path)
    ap.add_argument("--expected-buildings", type=int, default=23082)
    ap.add_argument("--chunk-size", type=int, default=500_000)
    ap.add_argument("--min-roof-points", type=int, default=8)
    ap.add_argument("--roof-quantile", type=float, default=0.5)
    args = ap.parse_args()

    if not 0.0 < args.roof_quantile < 1.0:
        raise SystemExit("--roof-quantile must be in (0,1)")

    doc = json.loads(args.geojson.read_text(encoding="utf-8"))
    features = doc.get("features", [])
    if len(features) != args.expected_buildings:
        raise SystemExit(f"expected {args.expected_buildings} footprints, found {len(features)}")

    to_las = Transformer.from_crs("EPSG:4326", "EPSG:2966", always_xy=True)
    polygons = []
    ids = []
    roof_z: dict[int, list[float]] = {}
    for feature in features:
        props = feature.get("properties", {})
        sid = props.get("igioObjectId", props.get("sourceObjectId"))
        if not isinstance(sid, int):
            raise SystemExit("every feature must have an integer igioObjectId")
        geom = shape(feature["geometry"])
        if geom.is_empty or not geom.is_valid:
            raise SystemExit(f"invalid geometry for OBJECTID {sid}")
        geom = transform(lambda x, y, z=None: to_las.transform(x, y), geom)
        polygons.append(geom)
        ids.append(sid)
        roof_z[sid] = []

    tree = STRtree(polygons)
    for las_path in args.las:
        with laspy.open(las_path) as reader:
            for chunk in reader.chunk_iterator(args.chunk_size):
                cls = np.asarray(chunk.classification)
                mask = cls == 6
                if not np.any(mask):
                    continue
                xs = np.asarray(chunk.x)[mask]
                ys = np.asarray(chunk.y)[mask]
                zs = np.asarray(chunk.z)[mask]
                for x, y, z in zip(xs.tolist(), ys.tolist(), zs.tolist()):
                    candidates = tree.query(Point(float(x), float(y)))
                    p = Point(float(x), float(y))
                    for candidate_index in candidates.tolist():
                        candidate = polygons[int(candidate_index)]
                        if candidate.covers(p):
                            sid = ids[int(candidate_index)]
                            roof_z[sid].append(float(z))
                            break

    failures = []
    for feature in features:
        props = feature.setdefault("properties", {})
        sid = int(props["igioObjectId"])
        values = roof_z[sid]
        if len(values) < args.min_roof_points:
            failures.append({"sourceObjectId": sid, "roofPointCount": len(values)})
            continue
        roof = float(np.quantile(np.asarray(values, dtype=np.float64), args.roof_quantile))
        ground = props.get("groundElevationMeanFt")
        if not isinstance(ground, (int, float)) or not math.isfinite(float(ground)):
            failures.append({"sourceObjectId": sid, "reason": "missing-ground-elevation"})
            continue
        height_ft = roof * 3.280839895013123 - float(ground)
        if not math.isfinite(height_ft) or height_ft <= 0:
            failures.append({"sourceObjectId": sid, "reason": "non-positive-height", "heightFt": height_ft})
            continue
        props["buildingHeightFt"] = height_ft
        props["roofElevationFtNavd88"] = roof * 3.280839895013123
        props["roofPointCount"] = len(values)
        props["heightMethod"] = "3DEP_CLASS6_ROOF_QUANTILE_MINUS_IGIO_JOINED_GROUND"
        props["heightAuthorityClass"] = "DERIVED"
        props["heightSource"] = "Indiana 3DEP QL2 classified LAS"
        props["heightSourceFiles"] = [p.name for p in args.las]

    if failures:
        raise SystemExit(
            f"LiDAR height coverage incomplete: {len(failures)} of {len(features)} failed; "
            f"first={failures[:20]}"
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(doc, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"buildings": len(features), "heightDerived": len(features), "lasTiles": len(args.las)}))


if __name__ == "__main__":
    main()
