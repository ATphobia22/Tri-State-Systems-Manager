#!/usr/bin/env python3
"""Reprocess NDHM heights using footprint-window statistics.

Replaces centroid-pixel sampling with proper zonal statistics:
for each building footprint, samples all NDHM pixels within the polygon
and computes median (robust to edge pixels and canopy gaps).

Updates buildings-3d.json in place for NDHM-sourced buildings.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.mask import mask
from rasterio.warp import transform_geom


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ndhm", required=True, help="NDHM raster path")
    ap.add_argument("--buildings", required=True, help="buildings-3d.json path")
    ap.add_argument("--output", required=True, help="Output path")
    args = ap.parse_args()

    with open(args.buildings) as f:
        data = json.load(f)

    ndhm_buildings = [
        f for f in data["features"]
        if f["properties"].get("source") == "Purdue Digital Forestry NDHM 2017-2019"
    ]
    print(f"Processing {len(ndhm_buildings)} NDHM buildings...", flush=True)

    updated = 0
    failed = 0

    with rasterio.open(args.ndhm) as src:
        for i, feat in enumerate(ndhm_buildings):
            try:
                geom = feat["geometry"]
                # Transform from WGS84 (EPSG:4326) to raster CRS (EPSG:2968)
                geom_2968 = transform_geom("EPSG:4326", src.crs, geom)
                # Mask the raster with the building footprint
                out_image, out_transform = mask(src, [geom_2968], crop=True, nodata=np.nan)
                values = out_image[0]
                # Filter valid pixels (not nodata, positive)
                valid = values[np.isfinite(values) & (values > 0)]
                if len(valid) >= 3:  # Need minimum pixels for robust stat
                    # Use median (robust to outliers/edge effects)
                    median_h = float(np.median(valid))
                    # Convert from feet to meters (NDHM is in feet)
                    median_m = median_h * 0.3048
                    feat["properties"]["height_m"] = round(median_m, 2)
                    feat["properties"]["method"] = "ndhm-footprint-median"
                    feat["properties"]["heightProvenance"] = (
                        f"Purdue Digital Forestry NDHM 2017-2019 "
                        f"(footprint median, n={len(valid)} pixels)"
                    )
                    updated += 1
                else:
                    failed += 1
            except Exception as e:
                failed += 1
                if failed < 5:
                    print(f"Warning: failed building {i}: {e}", flush=True)

            if (i + 1) % 1000 == 0:
                print(f"  {i+1}/{len(ndhm_buildings)}...", flush=True)

    with open(args.output, "w") as f:
        json.dump(data, f, separators=(",", ":"))

    print(f"Updated {updated}, failed {failed}", flush=True)
    print(f"Wrote {args.output}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
