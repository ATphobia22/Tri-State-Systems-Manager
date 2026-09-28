#!/usr/bin/env python3
"""
fetch-terrarium-dem.py — Download real elevation for the TSM flood-sim domain.

Source: AWS Open Data `elevation-tiles-prod` Terrarium tiles
(https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png),
derived from USGS 3DEP for CONUS. Terrarium encoding:
    elev_m = R * 256 + G + B / 256 - 32768

Output: a canonical ENU-feet grid JSON bundled with the app
(tsm-console/src/lib/flood-sim/world/data/source-derived-dem-posey.json),
resampled deterministically from the mosaic. The grid is a SCREENING-LEVEL
derivative (~15 m source posting at z13): it improves on the procedural
approximation but is NOT survey-grade and must never be presented as such.

Provenance (source URLs, tile list, zoom, datum notes, SHA-256) is written
alongside the grid in the same JSON and in a .manifest.json file.

Usage:
    python3 tools/terrain/fetch-terrarium-dem.py [--out PATH] [--zoom 13]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
import time
import urllib.request

import numpy as np
from PIL import Image

# --- anchor: 13101 Bonebank Rd, Point Township, Posey County, IN ---------------
ANCHOR_LAT = 37.845887
ANCHOR_LON = -88.005075
# Half-extent of the canonical grid, feet (must cover the 48x48x220ft scenario domain).
HALF_EXTENT_FT = 6000.0
CANONICAL_N = 192
TERRARIUM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
FT_PER_M = 3.28084
TILE_PX = 256

# 3DEP vertical reference for CONUS (screening-level statement — verify before
# any engineering use).
VERTICAL_DATUM = "NAVD88 (3DEP native, as reported; screening-level)"
HORIZONTAL_DATUM = "WGS84"


def lon_to_xtile(lon: float, z: int) -> float:
    return (lon + 180.0) / 360.0 * (2 ** z)


def lat_to_ytile(lat: float, z: int) -> float:
    lat_r = math.radians(lat)
    return (1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * (2 ** z)


def tile_lon(x: int, z: int) -> float:
    return x / (2 ** z) * 360.0 - 180.0


def tile_lat(y: int, z: int) -> float:
    n = math.pi - 2.0 * math.pi * y / (2 ** z)
    return math.degrees(math.atan(math.sinh(n)))


def fetch_tile(z: int, x: int, y: int, cache_dir: str, retries: int = 3) -> Image.Image:
    os.makedirs(cache_dir, exist_ok=True)
    path = os.path.join(cache_dir, f"terrarium-{z}-{x}-{y}.png")
    if os.path.exists(path):
        return Image.open(path).convert("RGB")
    url = TERRARIUM_URL.format(z=z, x=x, y=y)
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Tri-State-Systems-Manager/1.0 (research fetch)"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
            with open(path, "wb") as f:
                f.write(data)
            return Image.open(path).convert("RGB")
        except Exception as e:  # noqa: BLE001 - retry then fail loudly
            last = e
            time.sleep(2 ** attempt)
    raise RuntimeError(f"failed to fetch tile {z}/{x}/{y} after {retries} attempts: {last}")


def terrarium_to_elev_ft(img: Image.Image) -> np.ndarray:
    arr = np.asarray(img).astype(np.float64)
    elev_m = arr[:, :, 0] * 256.0 + arr[:, :, 1] + arr[:, :, 2] / 256.0 - 32768.0
    return elev_m * FT_PER_M


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--zoom", type=int, default=13)
    ap.add_argument("--half-deg", type=float, default=0.03,
                    help="half-extent of download window in degrees")
    ap.add_argument("--out", default="tsm-console/src/lib/flood-sim/world/data/source-derived-dem-posey.json")
    ap.add_argument("--cache-dir", default="tools/terrain/.tile-cache")
    args = ap.parse_args()

    z = args.zoom
    lon0, lon1 = ANCHOR_LON - args.half_deg, ANCHOR_LON + args.half_deg
    lat0, lat1 = ANCHOR_LAT - args.half_deg, ANCHOR_LAT + args.half_deg
    x0, x1 = math.floor(lon_to_xtile(lon0, z)), math.floor(lon_to_xtile(lon1, z))
    y0, y1 = math.floor(lat_to_ytile(lat1, z)), math.floor(lat_to_ytile(lat0, z))
    tiles = [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]
    print(f"downloading {len(tiles)} terrarium tiles at z{z}: x {x0}..{x1}, y {y0}..{y1}", flush=True)

    # Mosaic in tile-pixel space: mosaic row r covers tile y0 + r//256, pixel r%256.
    W = (x1 - x0 + 1) * TILE_PX
    H = (y1 - y0 + 1) * TILE_PX
    mosaic = np.full((H, W), np.nan)
    tile_urls = []
    for x, y in tiles:
        img = fetch_tile(z, x, y, args.cache_dir)
        elev = terrarium_to_elev_ft(img)
        r0, c0 = (y - y0) * TILE_PX, (x - x0) * TILE_PX
        mosaic[r0:r0 + TILE_PX, c0:c0 + TILE_PX] = elev
        tile_urls.append(TERRARIUM_URL.format(z=z, x=x, y=y))
        print(f"  tile {z}/{x}/{y}: elev range {np.nanmin(elev):.1f}..{np.nanmax(elev):.1f} ft", flush=True)

    if np.isnan(mosaic).any():
        bad = int(np.isnan(mosaic).sum())
        print(f"WARNING: {bad} mosaic pixels missing (void); filling by nearest valid", flush=True)
        # Simple nearest fill via iterative dilation of valid mask.
        from scipy import ndimage  # noqa
        raise SystemExit("scipy not available; refusing to invent void values")

    # Canonical grid: ENU feet relative to anchor, row-major, north-up.
    n = CANONICAL_N
    he = HALF_EXTENT_FT
    cos_lat = math.cos(math.radians(ANCHOR_LAT))
    ft_per_deg_lat = 364000.0  # ~111.2 km/deg
    ft_per_deg_lon = 364000.0 * cos_lat

    def lonlat_to_mosaic(lon: float, lat: float) -> tuple[float, float]:
        fx = lon_to_xtile(lon, z)
        fy = lat_to_ytile(lat, z)
        return (fy - y0) * TILE_PX, (fx - x0) * TILE_PX  # (row, col) float

    grid = np.zeros((n, n))
    for r in range(n):
        north_ft = he - (r + 0.5) * (2 * he / n)  # row 0 = north edge
        lat = ANCHOR_LAT + north_ft / ft_per_deg_lat
        for c in range(n):
            east_ft = -he + (c + 0.5) * (2 * he / n)
            lon = ANCHOR_LON + east_ft / ft_per_deg_lon
            mr, mc = lonlat_to_mosaic(lon, lat)
            r0i, c0i = int(math.floor(mr)), int(math.floor(mc))
            fr, fc = mr - r0i, mc - c0i
            r0i = min(max(r0i, 0), H - 2)
            c0i = min(max(c0i, 0), W - 2)
            a, b = mosaic[r0i, c0i], mosaic[r0i, c0i + 1]
            cc, d = mosaic[r0i + 1, c0i], mosaic[r0i + 1, c0i + 1]
            grid[r, c] = a + (b - a) * fc + (cc - a) * fr + (a - b - cc + d) * fc * fr

    grid = np.round(grid, 1)  # 0.1 ft keeps the JSON small; screening-level anyway
    flat = grid.reshape(-1).tolist()
    payload = {
        "id": "source-derived-dem-posey-valley-v1",
        "kind": "source-derived-screening",
        "description": (
            "Screening-level elevation grid derived from AWS elevation-tiles-prod "
            "Terrarium tiles (CONUS portion sourced from USGS 3DEP/NED per the "
            "Tilezen joerd attribution; the Terrarium mosaic blends multiple "
            "sources with mixed native vertical datums). NOT survey-grade; not a "
            "substitute for licensed survey where regulatory/design decisions apply."
        ),
        "source": "AWS Open Data elevation-tiles-prod (Terrarium); CONUS portion from USGS 3DEP/NED per Tilezen joerd attribution (mosaic, mixed native vertical datums)",
        "tileUrls": tile_urls,
        "zoom": z,
        "anchorLat": ANCHOR_LAT,
        "anchorLon": ANCHOR_LON,
        "halfExtentFt": he,
        "n": n,
        "cellFt": round(2 * he / n, 3),
        "verticalDatum": VERTICAL_DATUM,
        "horizontalDatum": HORIZONTAL_DATUM,
        "units": "ft",
        "layout": "row-major, row 0 = north edge, ENU feet relative to anchor",
        "statsFt": {
            "min": float(np.min(grid)),
            "max": float(np.max(grid)),
            "mean": float(round(np.mean(grid), 2)),
        },
        "gridFt": flat,
    }
    body = json.dumps(payload, separators=(",", ":")).encode()
    payload["sha256"] = hashlib.sha256(body).hexdigest()

    out_path = args.out
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(payload, f)
    manifest = {k: v for k, v in payload.items() if k != "gridFt"}
    with open(out_path + ".manifest.json", "w") as f:
        json.dump(manifest, f, indent=2)
    size_kb = os.path.getsize(out_path) / 1024
    print(f"wrote {out_path} ({size_kb:.0f} KB), sha256 {payload['sha256'][:16]}…")
    print(f"elevation {payload['statsFt']['min']:.1f}..{payload['statsFt']['max']:.1f} ft, "
          f"mean {payload['statsFt']['mean']:.1f} ft")
    return 0


if __name__ == "__main__":
    sys.exit(main())
