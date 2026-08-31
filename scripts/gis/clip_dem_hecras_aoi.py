#!/usr/bin/env python3
"""
Clip DEM to a user-supplied 2D flow-area bounding box (map units of the DEM CRS)
for HEC-RAS terrain import.

  python clip_dem_hecras_aoi.py dem.tif -o ras_terrain_clip.tif --bbox west south east north

TSM CRS policy: prefer EPSG:2966 ftUS + NAVD88. Record any reprojection in evidence.
"""
from __future__ import annotations
import argparse
from pathlib import Path

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("dem", type=Path)
    ap.add_argument("-o", "--out", type=Path, default=Path("hecras_terrain_clip.tif"))
    ap.add_argument("--bbox", nargs=4, type=float, required=True, metavar=("W", "S", "E", "N"))
    args = ap.parse_args()
    try:
        import rasterio
        from rasterio.windows import from_bounds
    except ImportError as e:
        raise SystemExit("pip install rasterio") from e
    west, south, east, north = args.bbox
    with rasterio.open(args.dem) as src:
        window = from_bounds(west, south, east, north, transform=src.transform)
        data = src.read(window=window, boundless=True)
        transform = src.window_transform(window)
        profile = src.profile.copy()
        profile.update(height=data.shape[1], width=data.shape[2], transform=transform, compress="deflate")
        args.out.parent.mkdir(parents=True, exist_ok=True)
        with rasterio.open(args.out, "w", **profile) as dst:
            dst.write(data)
    print(f"wrote {args.out}")

if __name__ == "__main__":
    main()
