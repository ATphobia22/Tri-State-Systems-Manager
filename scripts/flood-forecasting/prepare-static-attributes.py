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
import json
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


def _rasterize_polygon_mask(xs, ys, x_min, y_max, dx, dy, H, W):
    """Vectorized even-odd scanline polygon rasterization -> bool (H, W) mask.

    Pure numpy (no rasterio needed): for each polygon edge, XOR-toggle an
    event grid at scanline intersections, then take the row-wise cumulative
    parity. Pixel (r, c) center = (x_min + (c+0.5)*dx, y_max - (r+0.5)*dy).
    """
    xs = np.asarray(xs, dtype=float)
    ys = np.asarray(ys, dtype=float)
    n = len(xs)
    events = np.zeros((H, W + 1), dtype=np.int8)
    for i in range(n):
        x1, y1 = xs[i], ys[i]
        x2, y2 = xs[(i + 1) % n], ys[(i + 1) % n]
        if y1 == y2:
            continue  # horizontal edges never cross a scanline center
        y_lo, y_hi = (y1, y2) if y1 < y2 else (y2, y1)
        r_lo = max(0, int(np.floor((y_max - y_hi) / dy)))
        r_hi = min(H, int(np.ceil((y_max - y_lo) / dy)))
        if r_hi <= r_lo:
            continue
        rows = np.arange(r_lo, r_hi)
        yc = y_max - (rows + 0.5) * dy
        t = (yc - y1) / (y2 - y1)
        xi = x1 + t * (x2 - x1)
        cols = np.floor((xi - x_min) / dx).astype(int)
        valid = (cols >= 0) & (cols <= W)
        # XOR-toggle via add-then-parity (handles duplicate intersections)
        np.add.at(events, (rows[valid], cols[valid]), 1)
    return np.cumsum(events, axis=1)[:, :W] % 2 == 1


def _geom_mask(geom, total_bounds, H, W):
    """Bool (H, W) mask for a shapely Polygon/MultiPolygon over a grid
    spanning total_bounds = (minx, miny, maxx, maxy)."""
    minx, miny, maxx, maxy = total_bounds
    dx = (maxx - minx) / W
    dy = (maxy - miny) / H
    geoms = list(geom.geoms) if hasattr(geom, "geoms") else [geom]
    mask = np.zeros((H, W), dtype=bool)
    for g in geoms:
        try:
            xs, ys = g.exterior.coords.xy
        except Exception:
            continue
        mask |= _rasterize_polygon_mask(xs, ys, minx, maxy, dx, dy, H, W)
    return mask


def soil_texture_soilgrids(geom, total_bounds, max_samples: int = 9) -> tuple:
    """Basin-mean sand/silt/clay (%) via the SoilGrids v2.0 REST API.

    Samples up to max_samples points on a regular grid inside the basin
    polygon and averages the 0-5 cm mean values. SoilGrids is a global
    250 m product (ISRIC) — NOT SSURGO; columns are named accordingly.
    Returns (nan, nan, nan) with an honest note when the API is
    unreachable — resilient, never blocking.
    """
    import urllib.request
    minx, miny, maxx, maxy = total_bounds
    # Sample grid over the basin bbox
    n_side = max(2, int(np.ceil(np.sqrt(max_samples))))
    xs = np.linspace(minx, maxx, n_side + 2)[1:-1]
    ys = np.linspace(miny, maxy, n_side + 2)[1:-1]
    # Polygon mask test per sample point (point-in-polygon on the grid)
    geoms = list(geom.geoms) if hasattr(geom, "geoms") else [geom]
    rings = []
    for g in geoms:
        try:
            rx, ry = g.exterior.coords.xy
            rings.append((list(rx), list(ry)))
        except Exception:
            continue

    def _inside(x, y):
        for rx, ry in rings:
            inside = False
            n = len(rx)
            j = n - 1
            for i in range(n):
                if ((ry[i] > y) != (ry[j] > y)) and \
                   (x < (rx[j] - rx[i]) * (y - ry[i]) / (ry[j] - ry[i]) + rx[i]):
                    inside = not inside
                j = i
            if inside:
                return True
        return False

    pts = [(float(x), float(y)) for x in xs for y in ys if _inside(float(x), float(y))]
    if not pts:
        print("  NOTE: no SoilGrids sample points inside basin — soil NaN")
        return (float("nan"),) * 3
    sands, silts, clays = [], [], []
    for lon, lat in pts[:max_samples]:
        url = ("https://rest.isric.org/soilgrids/v2.0/properties/query"
               f"?lon={lon:.4f}&lat={lat:.4f}"
               "&property=sand&property=silt&property=clay"
               "&depth=0-5cm&value=mean")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "TSM/1.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())
            vals = {}
            for layer in data["properties"]["layers"]:
                d = layer["depths"][0]["values"]["mean"]
                vals[layer["name"]] = d / layer["unit_measure"]["d_factor"]
            sands.append(vals["sand"]); silts.append(vals["silt"]); clays.append(vals["clay"])
        except Exception as e:
            print(f"  NOTE: SoilGrids query failed at ({lon:.3f},{lat:.3f}): {e}")
            continue
    if not sands:
        print("  NOTE: all SoilGrids queries failed — soil NaN")
        return (float("nan"),) * 3
    return (float(np.mean(sands)), float(np.mean(silts)), float(np.mean(clays)))


def prism_climate(climate_dir: Path, geom) -> tuple:
    """Zonal means of PRISM 30-year normals (mean annual ppt mm, tmean C).

    Reads the tri-state-clipped grids in data/fabrics/climate/
    (pure numpy — no rasterio needed). Returns (nan, nan) with an honest
    note when the grids are missing or the basin falls outside the clip
    window — resilient, never blocking.
    """
    out = (float("nan"), float("nan"))
    ppt_path = climate_dir / "ppt_annual_tristate.npy"
    tmean_path = climate_dir / "tmean_annual_tristate.npy"
    if not ppt_path.exists() or not tmean_path.exists():
        print("  NOTE: PRISM climate grids not found in", climate_dir,
              "— ppt/tmean set to NaN")
        return out
    try:
        ppt_tfm = json.loads((climate_dir / "ppt_annual_tristate.transform.json").read_text())
        tmean_tfm = json.loads((climate_dir / "tmean_annual_tristate.transform.json").read_text())
    except Exception as e:
        print(f"  NOTE: PRISM transform sidecars unreadable ({e}) — ppt/tmean NaN")
        return out

    def zonal(grid_path, tfm):
        a, b, c, d, e, f = tfm
        arr = np.load(grid_path).astype(np.float64)
        H, W = arr.shape
        # grid envelope from the affine
        xs = [c, c + a * W]
        ys = [f, f + e * H]
        bounds = (min(xs), min(ys), max(xs), max(ys))
        mask = _geom_mask(geom, bounds, H, W)
        vals = arr[mask]
        vals = vals[vals != -9999]
        return float(vals.mean()) if len(vals) else float("nan")

    try:
        ppt = zonal(ppt_path, ppt_tfm)
        tmean = zonal(tmean_path, tmean_tfm)
    except Exception as e:
        print(f"  NOTE: PRISM zonal stats failed ({e}) — ppt/tmean NaN")
        return out
    if np.isnan(ppt) or np.isnan(tmean):
        print("  NOTE: basin outside PRISM tri-state clip window — ppt/tmean NaN")
    return ppt, tmean


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

    H, W, D = mean_emb.shape
    # Mask to the basin polygon (vectorized scanline rasterization;
    # no rasterio needed since TESSERA ships as .npy, not GeoTIFF).
    basin_mask = _geom_mask(geom, bounds, H, W)
    if not basin_mask.any():
        return [np.nan] * n_components
    flat = mean_emb[basin_mask]  # (N_in_basin, D)
    # Subsample for PCA fit (speed)
    idx = np.random.choice(len(flat), min(50000, len(flat)), replace=False)
    pca = PCA(n_components=n_components)
    pca.fit(flat[idx])
    pcs = pca.transform(flat)  # (N_in_basin, n_components)
    # Basin mean of each PC over the masked basin pixels
    return [float(pcs[:, i].mean()) for i in range(n_components)]


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
        ppt_mm, tmean_c = prism_climate(
            Path(__file__).resolve().parents[2] / "data" / "fabrics" / "climate",
            geom)
        # SoilGrids v2.0 (ISRIC) basin means — honest source labeling;
        # SSURGO spatial geodatabase remains a future enhancement.
        sand_pct, silt_pct, clay_pct = soil_texture_soilgrids(geom, basins.total_bounds)

        rows.append({
            "basin_id": bid,
            "area_km2": round(area_km2, 1),
            "mean_elev_m": round(mean_elev, 1),
            "mean_slope_deg": round(mean_slope, 2),
            "tessera_pc1": round(pcs[0], 4),
            "tessera_pc2": round(pcs[1], 4),
            "tessera_pc3": round(pcs[2], 4),
            "prism_ppt_mm": round(ppt_mm, 0),
            "prism_tmean_c": round(tmean_c, 1),
            "soilgrids_sand_pct": round(sand_pct, 1),
            "soilgrids_silt_pct": round(silt_pct, 1),
            "soilgrids_clay_pct": round(clay_pct, 1),
        })

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(out, index=False)
    print(f"\nWrote {len(rows)} basins → {out}")


if __name__ == "__main__":
    main()
