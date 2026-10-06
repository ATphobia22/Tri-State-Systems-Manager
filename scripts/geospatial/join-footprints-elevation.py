#!/usr/bin/env python3
"""Join building footprints to Terrain-RGB elevations (ft NAVD88).

Reuses the same fail-closed TerrainSampler rules as derive-building-models.py:
  * null elevation = unavailable (never zero)
  * mean/min/max + sample count written on each feature
  * no invented WSE; optional --wse-ft for screening flood depth only

Usage:
  python3 scripts/geospatial/join-footprints-elevation.py \\
    --input data/buildings/posey-ms-buildings-aoi.geojson \\
    --output data/buildings/posey-buildings-elev-joined.geojson \\
    --wse-ft 375.0
"""
from __future__ import annotations

import argparse
import json
import math
import os
from datetime import datetime, timezone

import numpy as np
from PIL import Image

M_TO_FT = 3.28084
ZOOM_CHAIN = (12, 11, 10, 9, 8)
GRID_SAMPLES = 25


class TerrainSampler:
    def __init__(self, terrain_dir: str):
        self.terrain_dir = terrain_dir
        self.cache = {}
        self.tiles_loaded = 0
        self.samples_ok = 0
        self.samples_missed = 0

    def _load_tile(self, z, x, y):
        key = (z, x, y)
        if key in self.cache:
            return self.cache[key]
        path = os.path.join(self.terrain_dir, str(z), str(x), f"{y}.png")
        if not os.path.exists(path):
            self.cache[key] = None
            return None
        try:
            arr = np.asarray(Image.open(path).convert("RGB"))
        except Exception:
            self.cache[key] = None
            return None
        self.cache[key] = arr
        self.tiles_loaded += 1
        return arr

    def sample_ft(self, lon, lat):
        for z in ZOOM_CHAIN:
            n = 2 ** z
            xtile = int((lon + 180.0) / 360.0 * n)
            lat_rad = math.radians(lat)
            ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
            arr = self._load_tile(z, xtile, ytile)
            if arr is None:
                continue
            lon_w = xtile / n * 360.0 - 180.0
            lat_n = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * ytile / n))))
            lat_s = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (ytile + 1) / n))))
            span = lat_n - lat_s
            if span <= 0:
                continue
            px = max(0, min(255, int((lon - lon_w) / 360.0 * n * 256)))
            py = max(0, min(255, int((lat_n - lat) / span * 256)))
            r, g, b = (int(v) for v in arr[py, px])
            elev_m = -10000.0 + ((r * 256 * 256 + g * 256 + b) * 0.1)
            self.samples_ok += 1
            return elev_m * M_TO_FT
        self.samples_missed += 1
        return None


def largest_ring(geom):
    t = geom.get("type")
    if t == "Polygon":
        ring = geom["coordinates"][0]
    elif t == "MultiPolygon":
        best, ba = None, -1.0
        for poly in geom["coordinates"]:
            r = poly[0]
            a = abs(sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1)))
            if a > ba:
                best, ba = r, a
        ring = best
    else:
        return None
    if ring and ring[0] == ring[-1]:
        ring = ring[:-1]
    return ring


def point_in_ring(lon, lat, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-15) + xi):
            inside = not inside
        j = i
    return inside


def sample_feature(geom, sampler, grid_n=GRID_SAMPLES):
    ring = largest_ring(geom)
    if not ring or len(ring) < 3:
        return None, None, None, 0, "NO_GEOMETRY"
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    w, s, e, n_ = min(lons), min(lats), max(lons), max(lats)
    side = max(1, int(math.sqrt(grid_n)))
    xs = [w + (e - w) * (i + 0.5) / side for i in range(side)] if e > w else [w]
    ys = [s + (n_ - s) * (j + 0.5) / side for j in range(side)] if n_ > s else [s]
    elevs = []
    for gx in xs:
        for gy in ys:
            if point_in_ring(gx, gy, ring):
                v = sampler.sample_ft(gx, gy)
                if v is not None:
                    elevs.append(v)
    clon, clat = sum(lons) / len(lons), sum(lats) / len(lats)
    c = sampler.sample_ft(clon, clat)
    if c is not None and c not in elevs:
        elevs.append(c)
    if not elevs:
        return None, None, None, 0, "UNAVAILABLE"
    coverage = "FULL" if len(elevs) >= 3 else "PARTIAL"
    return min(elevs), max(elevs), sum(elevs) / len(elevs), len(elevs), coverage


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--input", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--terrain-dir", default="tsm-console/public/terrain_3dep")
    ap.add_argument("--wse-ft", type=float, default=None)
    ap.add_argument("--wse-source", default="USER_PROVIDED")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    with open(args.input) as f:
        fc = json.load(f)
    features = fc.get("features", [])
    if args.limit > 0:
        features = features[: args.limit]

    sampler = TerrainSampler(args.terrain_dir)
    run_ts = datetime.now(timezone.utc).isoformat()
    out_feats = []
    n_no = 0
    for i, ft in enumerate(features):
        geom = ft.get("geometry") or {}
        props = dict(ft.get("properties") or {})
        emin, emax, emean, n, cov = sample_feature(geom, sampler)
        props["groundElevationMinFt"] = round(emin, 2) if emin is not None else None
        props["groundElevationMaxFt"] = round(emax, 2) if emax is not None else None
        props["groundElevationMeanFt"] = round(emean, 2) if emean is not None else None
        props["groundElevationFt"] = props["groundElevationMeanFt"]
        props["elevationSampleCount"] = n
        props["elevationCoverage"] = cov
        if cov == "UNAVAILABLE":
            n_no += 1
        if args.wse_ft is not None and emean is not None:
            raw = args.wse_ft - emean
            props["floodDepthFt"] = round(max(0.0, raw), 2)
            props["isFlooded"] = bool(raw > 0)
            props["wseUsedFt"] = args.wse_ft
            props["wseProvenance"] = args.wse_source
        elif args.wse_ft is not None:
            props["floodDepthFt"] = None
            props["isFlooded"] = None
            props["wseUsedFt"] = args.wse_ft
            props["wseProvenance"] = args.wse_source
        props["_elevationJoin"] = {
            "script": "scripts/geospatial/join-footprints-elevation.py",
            "runTimestampUtc": run_ts,
            "demSource": "Terrain-RGB tsm-console/public/terrain_3dep (screening)",
            "verticalDatum": "NAVD88 (ft, via Terrain-RGB decode)",
            "nullMeansUnavailable": True,
        }
        props["authorityClass"] = "DERIVED"
        props["engineeringUse"] = False
        props["regulatoryUse"] = False
        out_feats.append({"type": "Feature", "geometry": geom, "properties": props})
        if (i + 1) % 500 == 0:
            print(f"  ... {i + 1}/{len(features)}", flush=True)

    out = dict(fc)
    out["features"] = out_feats
    out["featureCount"] = len(out_feats)
    out["elevationJoin"] = {
        "runTimestampUtc": run_ts,
        "input": args.input,
        "parcelsWithoutElevation": n_no,
        "terrainTilesLoaded": sampler.tiles_loaded,
        "wseFt": args.wse_ft,
        "provisional": True,
        "humanReviewRequired": True,
    }
    with open(args.output, "w") as f:
        json.dump(out, f)
    print(f"done: {len(out_feats)} -> {args.output} (no elev: {n_no})")


if __name__ == "__main__":
    main()
