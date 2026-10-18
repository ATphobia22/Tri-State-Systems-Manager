#!/usr/bin/env python3
"""
TSM Static Attribute Prep — assembles catchment attributes for OpenHydroNet.

Reads TSM data fabrics and produces the static attributes CSV that
OpenHydroNet expects (one row per basin_id).

Inputs (from TSM repo data fabrics):
  - USGS 3DEP 1m DEM        → mean elevation, mean slope, drainage area
  - SSURGO soils            → sand/silt/clay %, soil depth
  - TESSERA embeddings      → land-cover PCs (first 3 principal components)
  - Basin polygons          → GeoJSON catchments delineated upstream of gages

Output:
  ./data/tsm-static-attributes.csv

Prereqs:
  pip install geopandas rasterio numpy pandas scikit-learn

Usage:
  python prepare-static-attributes.py \
    --basins ./data/tsm-basins.geojson \
    --dem ./data/3dep-dem.tif \
    --tessera ./tessera-tristate/ \
    --out ./data/tsm-static-attributes.csv
"""

import argparse
from pathlib import Path

import numpy as np
import pandas as pd


def zonal_mean(raster_path: Path, geom) -> float:
    """Mean raster value within a polygon."""
    import rasterio
    from rasterio.mask import mask
    with rasterio.open(raster_path) as src:
        out, _ = mask(src, [geom], crop=True, nodata=src.nodata)
        vals = out[0][out[0] != src.nodata]
        return float(vals.mean()) if len(vals) else np.nan


def zonal_slope(dem_path: Path, geom) -> float:
    """Mean slope (degrees) within a polygon, derived from DEM."""
    import rasterio
    from rasterio.mask import mask
    with rasterio.open(dem_path) as src:
        out, transform = mask(src, [geom], crop=True, nodata=src.nodata)
        dem = out[0].astype(np.float64)
        # Simple finite-difference slope
        dy, dx = np.gradient(dem, abs(transform[0]), abs(transform[4]))
        slope = np.degrees(np.arctan(np.sqrt(dx**2 + dy**2)))
        valid = (out[0] != src.nodata)
        return float(slope[valid].mean()) if valid.any() else np.nan


def tessera_pcs(tessera_dir: Path, geom, bounds, n_components: int = 3) -> list:
    """
    Reduce TESSERA 128-dim embeddings to n principal components,
    averaged over the basin polygon.
    Returns list of n floats.
    """
    from sklearn.decomposition import PCA
    # Load all yearly embeddings, stack, take mean across years
    yearly = []
    for f in sorted(tessera_dir.glob("tessera_*_tristate.npy")):
        arr = np.load(f)  # (H, W, 128)
        yearly.append(arr)
    if not yearly:
        return [np.nan] * n_components
    mean_emb = np.mean(yearly, axis=0)  # (H, W, 128)

    # TODO: clip to geom using rasterio window + mask
    # For now: global PCA, then basin mean
    H, W, D = mean_emb.shape
    flat = mean_emb.reshape(-1, D)
    # Subsample for PCA fit (speed)
    idx = np.random.choice(len(flat), min(50000, len(flat)), replace=False)
    pca = PCA(n_components=n_components)
    pca.fit(flat[idx])
    pcs = pca.transform(flat).reshape(H, W, n_components)
    # Basin mean of each PC (TODO: mask to geom)
    return [float(pcs[:, :, i].mean()) for i in range(n_components)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--basins", required=True, help="GeoJSON of basin polygons (must have basin_id)")
    ap.add_argument("--dem", required=True, help="3DEP DEM GeoTIFF")
    ap.add_argument("--tessera", default="./tessera-tristate", help="TESSERA .npy dir")
    ap.add_argument("--out", default="./data/tsm-static-attributes.csv")
    args = ap.parse_args()

    import geopandas as gpd
    basins = gpd.read_file(args.basins)
    dem_path = Path(args.dem)
    tessera_dir = Path(args.tessera)

    rows = []
    for _, row in basins.iterrows():
        bid = row["basin_id"]
        geom = row.geometry
        print(f"Processing {bid} ...")

        area_km2 = geom.area / 1e6  # assumes projected CRS in meters
        mean_elev = zonal_mean(dem_path, geom)
        mean_slope = zonal_slope(dem_path, geom)
        pcs = tessera_pcs(tessera_dir, geom, basins.total_bounds)

        rows.append({
            "basin_id": bid,
            "area_km2": round(area_km2, 1),
            "mean_elev_m": round(mean_elev, 1),
            "mean_slope_deg": round(mean_slope, 2),
            "tessera_pc1": round(pcs[0], 4),
            "tessera_pc2": round(pcs[1], 4),
            "tessera_pc3": round(pcs[2], 4),
            # TODO: add SSURGO sand/silt/clay when county data is assembled
            # TODO: add PRISM climate normals (mean annual P, T)
        })

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(out, index=False)
    print(f"\nWrote {len(rows)} basins → {out}")


if __name__ == "__main__":
    main()
