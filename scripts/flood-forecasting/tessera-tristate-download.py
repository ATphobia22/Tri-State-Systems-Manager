#!/usr/bin/env python3
"""
TESSERA embeddings download for the TSM tri-state region.

Pulls 128-dimensional, 10m annual land embeddings (2017-2025) from the
AWS Open Data Registry Icechunk store for the Ohio-Wabash tri-state area.

Prereqs: pip install icechunk "numcodecs[pcodec]" xarray s3fs pyproj numpy

Dataset: https://registry.opendata.aws/tessera/  (CC-BY-SA)
Docs:    https://github.com/dClimate/tessera-embeddings/blob/main/docs/global-store.md
Store:   s3://tessera-embeddings/v1.1/dclimate.icechunk (us-west-2, anonymous reads OK)

Updated 2026-10-18: Rewritten to use the working Icechunk pattern.
The geotessera client API pattern does not work — use icechunk directly.

Zone 16N covers the entire tri-state area (EPSG:32616).
Northing is DESCENDING (step -10m) — slice as slice(N_MAX, N_MIN).
Dequantize: embeddings * scales (float32). NaN scale = unembedded pixel.
"""

import os
from pathlib import Path

import numpy as np

from tsm_config import (
    ANCHOR_UTM_E, ANCHOR_UTM_N,
    TESSERA_BUCKET, TESSERA_PREFIX, TESSERA_REGION,
    TESSERA_ZONE, TESSERA_YEAR,
    OUTPUT_DIRS,
)

OUT_DIR = Path(os.environ.get("TESSERA_OUT", str(OUTPUT_DIRS["tessera"])))
OUT_DIR.mkdir(parents=True, exist_ok=True)


def open_store():
    """Open the TESSERA Icechunk store (anonymous)."""
    import icechunk

    storage = icechunk.s3_storage(
        bucket=TESSERA_BUCKET.replace("s3://", ""),
        prefix=TESSERA_PREFIX,
        region=TESSERA_REGION,
        anonymous=True,
    )
    repo = icechunk.Repository.open(storage=storage)
    session = repo.readonly_session(branch="main")
    return session.store


def download_window(
    year: int = TESSERA_YEAR,
    center_e: int = ANCHOR_UTM_E,
    center_n: int = ANCHOR_UTM_N,
    half_width_m: int = 10000,
    zone: str = TESSERA_ZONE,
) -> Path:
    """
    Download a square window of TESSERA embeddings centered on (E, N).

    Default: 20km x 20km centered on anchor site, year 2025.
    Output: float32 dequantized array, shape (H, W, 128).
    """
    import xarray as xr

    out_path = OUT_DIR / f"tessera_{year}_anchor_{half_width_m*2//1000}km.npy"
    if out_path.exists():
        print(f"[{year}] already downloaded: {out_path}")
        return out_path

    print(f"[{year}] opening TESSERA store (zone {zone})...")
    store = open_store()

    group_path = f"{zone}"
    print(f"[{year}] opening group: {group_path}")

    ds = xr.open_zarr(store, group=group_path, chunks={})
    print(f"  Dims: {dict(ds.sizes)}")

    # Time index: 0=2017, ..., 8=2025
    time_idx = year - 2017

    e_min, e_max = center_e - half_width_m, center_e + half_width_m
    n_min, n_max = center_n - half_width_m, center_n + half_width_m

    print(f"[{year}] window: E {e_min}-{e_max}, N {n_min}-{n_max}")
    print(f"[{year}] loading embeddings...")

    # Northing is descending — slice(max, min)
    emb = ds["embeddings"].isel(time=time_idx).sel(
        easting=slice(e_min, e_max),
        northing=slice(n_max, n_min),
    )
    scales = ds["scales"].isel(time=time_idx).sel(
        easting=slice(e_min, e_max),
        northing=slice(n_max, n_min),
    )

    emb_vals = emb.values.astype(np.float32)
    scale_vals = scales.values.astype(np.float32)

    valid = ~np.isnan(scale_vals)
    print(f"[{year}] valid pixels: {valid.sum():,} / {valid.size:,} "
          f"({100*valid.sum()/valid.size:.1f}%)")
    print(f"  Embeddings shape: {emb_vals.shape}")
    print(f"  Scales shape: {scale_vals.shape}")

    if emb_vals.shape[-1] == 128:
        dequant = emb_vals * scale_vals[..., np.newaxis]
    elif emb_vals.shape[0] == 128:
        dequant = np.transpose(emb_vals * scale_vals[np.newaxis, ...], (1, 2, 0))
    else:
        raise ValueError(f"Unexpected embeddings shape: {emb_vals.shape}")

    if dequant.shape[-1] == 128:
        dequant[~valid] = 0

    print(f"[{year}] dequantized shape: {dequant.shape}, dtype: {dequant.dtype}")
    print(f"[{year}] saving ({dequant.nbytes / 1e9:.1f} GB)...")
    np.save(out_path, dequant)
    print(f"[{year}] done: {out_path}")
    return out_path


def download_tristate_tiled(year: int = TESSERA_YEAR, tile_km: int = 20):
    """Download full tri-state bbox as tiles (130+ GB — use with caution)."""
    E_MIN, E_MAX = 349932, 482560
    N_MIN, N_MAX = 4161455, 4262663

    tile_m = tile_km * 1000
    n_tiles_x = (E_MAX - E_MIN + tile_m - 1) // tile_m
    n_tiles_y = (N_MAX - N_MIN + tile_m - 1) // tile_m
    total = n_tiles_x * n_tiles_y

    print(f"Full tri-state: {n_tiles_x}x{n_tiles_y} = {total} tiles (~130+ GB)")
    confirm = input(f"Download {total} tiles? [y/N]: ")
    if confirm.lower() != "y":
        print("Cancelled.")
        return

    for ix in range(n_tiles_x):
        for iy in range(n_tiles_y):
            cx = E_MIN + ix * tile_m + tile_m // 2
            cy = N_MIN + iy * tile_m + tile_m // 2
            print(f"\nTile {ix*n_tiles_y+iy+1}/{total}: ({cx}, {cy})")
            try:
                download_window(year, cx, cy, tile_m // 2)
            except Exception as e:
                print(f"  FAILED: {e}")


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="TESSERA download (Icechunk)")
    ap.add_argument("--year", type=int, default=TESSERA_YEAR)
    ap.add_argument("--half-width-m", type=int, default=10000)
    ap.add_argument("--full-tristate", action="store_true")
    ap.add_argument("--tile-km", type=int, default=20)
    args = ap.parse_args()

    if args.full_tristate:
        download_tristate_tiled(args.year, args.tile_km)
    else:
        download_window(args.year, half_width_m=args.half_width_m)
