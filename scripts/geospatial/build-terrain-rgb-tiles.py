#!/usr/bin/env python3
"""Build a Mapbox Terrain-RGB tile pyramid from the bundled screening DEM.

Reads tsm-console/src/lib/flood-sim/world/data/source-derived-dem-posey.json
(192x192 grid, ENU feet, NAVD88 as reported by the 3DEP source) and renders
Web-Mercator XYZ PNG tiles using the Mapbox Terrain-RGB encoding:

    encoded = round((elev_m + 10000) * 10)
    R = encoded >> 16, G = (encoded >> 8) & 255, B = encoded & 255

Pure Python + numpy + Pillow; no GDAL required. Elevations are
screening-level, not survey-grade — the encoding carries no datum transform.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ORIGIN = 20037508.342789244  # half the Web-Mercator world width, meters
FT_PER_M = 3.28084
TILE_PX = 256


def lon_to_mx(lon: float) -> float:
    return lon * ORIGIN / 180.0


def lat_to_my(lat: float) -> float:
    return ORIGIN * math.log(math.tan(math.radians(45.0 + lat / 2.0))) / math.pi


def my_to_lat(my: float) -> float:
    return math.degrees(2.0 * math.atan(math.exp(my * math.pi / ORIGIN)) - math.pi / 2.0)


def mx_to_lon(mx: float) -> float:
    return mx * 180.0 / ORIGIN


def tile_range(mx0: float, my0: float, mx1: float, my1: float, z: int):
    """XYZ tile range covering a mercator box. my1 > my0 (north > south)."""
    n = 2**z
    world = 2 * ORIGIN
    x0 = max(0, math.floor((mx0 + ORIGIN) / world * n))
    x1 = min(n - 1, math.floor((mx1 + ORIGIN) / world * n))
    # XYZ y grows southward: north edge -> smaller y
    y0 = max(0, math.floor((ORIGIN - my1) / world * n))
    y1 = min(n - 1, math.floor((ORIGIN - my0) / world * n))
    return x0, x1, y0, y1


def encode_terrain_rgb(elev_m: np.ndarray) -> np.ndarray:
    if not np.all(np.isfinite(elev_m)):
        raise ValueError("non-finite elevations in tile")
    enc = np.rint((elev_m + 10000.0) * 10.0).astype(np.int64)
    if np.any(enc < 0) or np.any(enc > 16777215):
        bad = elev_m[(enc < 0) | (enc > 16777215)]
        raise ValueError(f"elevations outside Terrain-RGB range: min {bad.min()}, max {bad.max()}")
    r = ((enc >> 16) & 255).astype(np.uint8)
    g = ((enc >> 8) & 255).astype(np.uint8)
    b = (enc & 255).astype(np.uint8)
    return np.dstack((r, g, b))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dem-json", required=True, type=Path)
    ap.add_argument("--out-dir", required=True, type=Path)
    ap.add_argument("--minzoom", type=int, default=11)
    ap.add_argument("--maxzoom", type=int, default=15)
    ap.add_argument("--tiles-url", default="https://tiles.example.com/terrain-rgb/{z}/{x}/{y}.png",
                    help="URL template written into tiles.json")
    args = ap.parse_args()

    dem = json.loads(args.dem_json.read_text())
    n = dem["n"]
    cell_ft = dem["cellFt"]
    half_ft = dem["halfExtentFt"]
    anchor_lat = dem["anchorLat"]
    anchor_lon = dem["anchorLon"]
    grid = np.array(dem["gridFt"], dtype=np.float64).reshape(n, n)
    if not np.all(np.isfinite(grid)):
        raise ValueError("DEM grid contains non-finite values")

    half_m = half_ft / FT_PER_M
    mx_c, my_c = lon_to_mx(anchor_lon), lat_to_my(anchor_lat)

    total = 0
    for z in range(args.minzoom, args.maxzoom + 1):
        tile_m = 2 * ORIGIN / (2**z)
        x0, x1, y0, y1 = tile_range(mx_c - half_m, my_c - half_m,
                                    mx_c + half_m, my_c + half_m, z)
        for ty in range(y0, y1 + 1):
            for tx in range(x0, x1 + 1):
                # Pixel centers in Web-Mercator meters.
                px = np.arange(TILE_PX, dtype=np.float64)
                mx = -ORIGIN + (tx + (px + 0.5) / TILE_PX) * tile_m
                my = ORIGIN - (ty + (px + 0.5) / TILE_PX) * tile_m
                mxg, myg = np.meshgrid(mx, my)
                # Local ENU feet relative to the anchor.
                e_ft = (mxg - mx_c) * FT_PER_M
                n_ft = (myg - my_c) * FT_PER_M
                # DEM float coords (row 0 = north edge, col 0 = west edge).
                fx = (e_ft + half_ft) / cell_ft - 0.5
                fy = (half_ft - n_ft) / cell_ft - 0.5
                fx = np.clip(fx, 0, n - 1 - 1e-9)
                fy = np.clip(fy, 0, n - 1 - 1e-9)
                x_lo = np.floor(fx).astype(np.int64)
                y_lo = np.floor(fy).astype(np.int64)
                wx = fx - x_lo
                wy = fy - y_lo
                v00 = grid[y_lo, x_lo]
                v10 = grid[y_lo, x_lo + 1]
                v01 = grid[y_lo + 1, x_lo]
                v11 = grid[y_lo + 1, x_lo + 1]
                elev_ft = (v00 * (1 - wx) * (1 - wy) + v10 * wx * (1 - wy)
                           + v01 * (1 - wx) * wy + v11 * wx * wy)
                rgb = encode_terrain_rgb(elev_ft / FT_PER_M)
                out = args.out_dir / str(z) / str(tx) / f"{ty}.png"
                out.parent.mkdir(parents=True, exist_ok=True)
                Image.fromarray(rgb, mode="RGB").save(out, optimize=True)
                total += 1

    # TileJSON for MapLibre/Mapbox clients.
    tilejson = {
        "tilejson": "3.0.0",
        "name": "tsm-terrain-rgb-posey",
        "description": ("Screening-level Terrain-RGB elevation, 3DEP-derived, "
                        "not survey-grade. NAVD88 as reported by source."),
        "version": "1.0.0",
        "scheme": "xyz",
        "tiles": [args.tiles_url],
        "minzoom": args.minzoom,
        "maxzoom": args.maxzoom,
        "bounds": [mx_to_lon(mx_c - half_m), my_to_lat(my_c - half_m),
                   mx_to_lon(mx_c + half_m), my_to_lat(my_c + half_m)],
        "center": [anchor_lon, anchor_lat, args.maxzoom],
        "format": "png",
        "encoding": "terrarium=false;mapbox-terrain-rgb",
    }
    (args.out_dir / "tiles.json").write_text(json.dumps(tilejson, indent=2) + "\n")

    # Round-trip verification: decode the deepest-zoom center tile back.
    z = args.maxzoom
    n2 = 2**z
    ctx = int((mx_c + ORIGIN) / (2 * ORIGIN) * n2)
    cty = int((ORIGIN - my_c) / (2 * ORIGIN) * n2)
    sample = args.out_dir / str(z) / str(ctx) / f"{cty}.png"
    if sample.exists():
        px = np.asarray(Image.open(sample)).astype(np.int64)
        enc = (px[:, :, 0] << 16) | (px[:, :, 1] << 8) | px[:, :, 2]
        elev_m = enc / 10.0 - 10000.0
        cy = px.shape[0] // 2
        got_ft = elev_m[cy, cy] * FT_PER_M
        # Expected: bilinear value at the tile-center pixel's ENU position.
        tile_m = 2 * ORIGIN / n2
        mx = -ORIGIN + (ctx + 0.5) * tile_m
        my = ORIGIN - (cty + 0.5) * tile_m
        e_ft = (mx - mx_c) * FT_PER_M
        n_ft = (my - my_c) * FT_PER_M
        fx = (e_ft + half_ft) / cell_ft - 0.5
        fy = (half_ft - n_ft) / cell_ft - 0.5
        ix, iy = int(math.floor(fx)), int(math.floor(fy))
        wx, wy = fx - ix, fy - iy
        exp_ft = float(grid[iy, ix] * (1 - wx) * (1 - wy) + grid[iy, ix + 1] * wx * (1 - wy)
                       + grid[iy + 1, ix] * (1 - wx) * wy + grid[iy + 1, ix + 1] * wx * wy)
        drift = abs(got_ft - exp_ft)
        print(f"round-trip: tile z{z}/{ctx}/{cty} center {got_ft:.2f} ft "
              f"(expected {exp_ft:.2f} ft, drift {drift:.3f} ft)")
        if drift > 0.2:
            raise SystemExit(f"round-trip drift {drift:.3f} ft exceeds 0.2 ft tolerance")

    print(f"wrote {total} tiles to {args.out_dir} (z{args.minzoom}-z{args.maxzoom})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
