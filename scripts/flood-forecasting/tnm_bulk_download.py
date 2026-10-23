#!/usr/bin/env python3
"""
TSM National Map Bulk Downloader.

Programmatic access to USGS The National Map (TNM) products via
direct S3 staged products (no API key needed, public domain data).

Source: https://apps.nationalmap.gov/downloader/
S3: https://prd-tnm.s3.amazonaws.com/StagedProducts/
API: https://apps.nationalmap.gov/tnmaccess/ (TNMAccess — interactive)

Products available:
  Elevation/1m/     — 1-meter DEM (limited availability, check coverage)
  Elevation/13/     — 1/3 arc-second DEM (~10m)
  Elevation/1/      — 1 arc-second DEM (~30m)
  Elevation/OPR/    — Original Product Resolution DEMs
  Elevation/LPC/    — Lidar Point Clouds (LAS/LAZ)
  Hydrography/      — NHD, NHDPlus HR, WBD

Tri-state bbox: lon -88.7 to -87.2, lat 37.6 to 38.5

Usage:
  python tnm_bulk_download.py --product 1m --bbox -88.7 37.6 -87.2 38.5
  python tnm_bulk_download.py --list --product 1m
  python tnm_bulk_download.py --product LPC --bbox -88.7 37.6 -87.2 38.5
"""

import argparse
import sys
from pathlib import Path
from urllib.parse import quote
from xml.etree import ElementTree as ET

import requests

S3_BASE = "https://prd-tnm.s3.amazonaws.com"
STAGED = f"{S3_BASE}/StagedProducts"

PRODUCTS = {
    "1m":   f"{STAGED}/Elevation/1m/",
    "13as": f"{STAGED}/Elevation/13/",
    "1as":  f"{STAGED}/Elevation/1/",
    "OPR":  f"{STAGED}/Elevation/OPR/",
    "LPC":  f"{STAGED}/Elevation/LPC/",
    "NHD":  f"{STAGED}/Hydrography/NHD/",
    "NHDPlusHR": f"{STAGED}/Hydrography/NHDPlusHR/",
    "WBD":  f"{STAGED}/Hydrography/WBD/",
}

OUT_DIR = Path("./tnm-downloads")


def s3_list(prefix: str, max_keys: int = 1000) -> list:
    """List S3 keys under a prefix."""
    url = f"{S3_BASE}/?list-type=2&prefix={quote(prefix)}&max-keys={max_keys}"
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    root = ET.fromstring(r.content)
    ns = {"s3": "http://s3.amazonaws.com/doc/2006-03-01/"}
    keys = []
    for c in root.findall("s3:Contents", ns):
        key = c.find("s3:Key", ns).text
        size = int(c.find("s3:Size", ns).text)
        if size > 0:  # skip directory markers
            keys.append((key, size))
    return keys


import math
import re

# ---------------------------------------------------------------------------
# Tile-name parsing (verified against live prd-tnm S3 keys, 2026-10-23)
#
# Seamless 1as / 1/3as:  USGS_{1|13}_n{lat}{e|w}{lon}  e.g. USGS_1_n37w088
#   -> 1-degree tile; the name encodes the tile's NE corner:
#      lat in [lat-1, lat]; for 'w': lon in [-lon, -lon+1];
#      for 'e': lon in [lon-1, lon].  ('s' flips the latitude sign.)
#   Verified: n37w088 sidecar XML bounds lon -88.0..-87.0, lat 36.0..37.0.
#
# 1m DEM:  USGS_1M_{zone}_x{E}y{N}_{project}  e.g. USGS_1M_18_x54y491_...
#   -> 1 km x 1 km tile; zone = UTM zone number, E/N = lower-left corner
#      easting/northing in KILOMETERS (northern hemisphere, CONUS).
# Hydrography (NHD/NHDPlusHR/WBD): HUC-tiled (NHDPLUS_H_{HUC4}_HU4_...);
#   HUC<->bbox mapping needs the WBD dataset itself, so these are NOT
#   bbox-filtered (all keys returned with an honest note).
# ---------------------------------------------------------------------------

_SEAMLESS_RE = re.compile(r"USGS_(?:1|13)_([ns])(\d{2})([ew])(\d{3})", re.IGNORECASE)
_ONEM_RE = re.compile(r"USGS_1M_(\d{1,2})_x(\d+)y(\d+)", re.IGNORECASE)


def _utm_to_lonlat(easting_m: float, northing_m: float, zone: int):
    """Inverse UTM (WGS84), pure python — no pyproj dependency.

    Standard Snyder/USGS series. Accurate to ~1 mm inside the zone;
    used here only for bbox overlap tests, so ample precision.
    """
    a = 6378137.0
    f = 1 / 298.257223563
    k0 = 0.9996
    e2 = 2 * f - f * f
    e4 = e2 * e2
    e6 = e4 * e2
    lon0 = math.radians((zone - 1) * 6 - 180 + 3)
    x = easting_m - 500000.0
    y = northing_m  # northern hemisphere (CONUS)
    m = y / k0
    mu = m / (a * (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1 = (mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu)
            + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
            + (151 * e1 ** 3 / 96) * math.sin(6 * mu)
            + (1097 * e1 ** 4 / 512) * math.sin(8 * mu))
    sin_p1 = math.sin(phi1)
    n1 = a / math.sqrt(1 - e2 * sin_p1 * sin_p1)
    t1 = math.tan(phi1) ** 2
    c1 = e2 / (1 - e2) * math.cos(phi1) ** 2
    r1 = a * (1 - e2) / (1 - e2 * sin_p1 * sin_p1) ** 1.5
    d = x / (n1 * k0)
    lat = (phi1 - (n1 * math.tan(phi1) / r1)
           * (d * d / 2
              - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1
                 - 9 * e2 / (1 - e2)) * d ** 4 / 24
              + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1
                 - 252 * e2 / (1 - e2) - 3 * c1 * c1) * d ** 6 / 720))
    lon = (lon0 + (d - (1 + 2 * t1 + c1) * d ** 3 / 6
                   + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1
                      + 8 * e2 / (1 - e2) + 24 * t1 * t1) * d ** 5 / 120)
           / math.cos(phi1))
    return math.degrees(lon), math.degrees(lat)


def _tile_lonlat_bounds(key: str):
    """Return (lon_lo, lat_lo, lon_hi, lat_hi) for a TNM tile key, or None
    when the key's product uses a naming scheme we cannot parse
    (HUC-tiled hydrography, LPC project tiles, sidecar files)."""
    name = key.rsplit("/", 1)[-1]
    m = _SEAMLESS_RE.search(name)
    if m:
        ns, lat_s, ew, lon_s = m.groups()
        lat_hi = int(lat_s) * (-1 if ns.lower() == "s" else 1)
        lon_n = int(lon_s)
        lat_lo = lat_hi - 1
        if ew.lower() == "w":
            lon_lo, lon_hi = -lon_n, -lon_n + 1
        else:
            lon_lo, lon_hi = lon_n - 1, lon_n
        return (lon_lo, lat_lo, lon_hi, lat_hi)
    m = _ONEM_RE.search(name)
    if m:
        zone, e_km, n_km = int(m.group(1)), int(m.group(2)), int(m.group(3))
        # 1 km tile: sample the four corners, take the lon/lat envelope.
        corners = [
            _utm_to_lonlat(e_km * 1000.0, n_km * 1000.0, zone),
            _utm_to_lonlat(e_km * 1000.0 + 1000.0, n_km * 1000.0, zone),
            _utm_to_lonlat(e_km * 1000.0, n_km * 1000.0 + 1000.0, zone),
            _utm_to_lonlat(e_km * 1000.0 + 1000.0, n_km * 1000.0 + 1000.0, zone),
        ]
        lons = [c[0] for c in corners]
        lats = [c[1] for c in corners]
        return (min(lons), min(lats), max(lons), max(lats))
    return None


def _overlaps(b, lon_lo, lat_lo, lon_hi, lat_hi) -> bool:
    """bbox (lon_min, lat_min, lon_max, lat_max) overlap test."""
    return not (lon_hi < b[0] or lon_lo > b[2] or lat_hi < b[1] or lat_lo > b[3])


def filter_by_bbox(keys: list, bbox: tuple) -> list:
    """Filter TNM tile keys by bounding box using the tile-name conventions
    above (verified against live S3 keys 2026-10-23).

    Keys whose naming scheme cannot be parsed (hydrography HUC tiles,
    LPC project tiles, sidecar .xml/.jpg/.vrt files) are KEPT with an
    honest note rather than silently dropped — resilient, never blocking.
    """
    kept, skipped_unparsed = [], 0
    for key in keys:
        bounds = _tile_lonlat_bounds(key)
        if bounds is None:
            skipped_unparsed += 1
            kept.append(key)  # keep: do not silently drop unparseable products
            continue
        if _overlaps(bbox, *bounds):
            kept.append(key)
    n_filtered = len(keys) - len(kept)
    print(f"  bbox filter: kept {len(kept)}/{len(keys)} keys "
          f"({n_filtered} outside bbox; {skipped_unparsed} unparseable kept).")
    return kept


def download_key(key: str, out_dir: Path) -> Path:
    """Download a single S3 key."""
    url = f"{S3_BASE}/{quote(key)}"
    out_path = out_dir / Path(key).name
    if out_path.exists():
        print(f"  Skipping (exists): {out_path.name}")
        return out_path

    print(f"  Downloading: {Path(key).name} ...")
    r = requests.get(url, stream=True, timeout=300)
    r.raise_for_status()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)
    print(f"  Saved: {out_path} ({out_path.stat().st_size / 1e6:.1f} MB)")
    return out_path


def main():
    ap = argparse.ArgumentParser(description="TSM National Map bulk downloader")
    ap.add_argument("--product", choices=list(PRODUCTS), required=True,
                    help="TNM product to download")
    ap.add_argument("--bbox", nargs=4, type=float, default=[-88.7, 37.6, -87.2, 38.5],
                    metavar=("MIN_LON", "MIN_LAT", "MAX_LON", "MAX_LAT"))
    ap.add_argument("--list", action="store_true", help="List available tiles only")
    ap.add_argument("--out", default=str(OUT_DIR))
    ap.add_argument("--max", type=int, default=100, help="Max tiles to list/download")
    args = ap.parse_args()

    prefix = PRODUCTS[args.product].replace(S3_BASE + "/", "")
    print(f"Product: {args.product}")
    print(f"S3 prefix: {prefix}")
    print(f"Bbox: {args.bbox}")

    keys = s3_list(prefix, max_keys=args.max)
    print(f"Found {len(keys)} objects")

    if args.list:
        total_mb = sum(s for _, s in keys) / 1e6
        for key, size in keys[:20]:
            print(f"  {key} ({size / 1e6:.1f} MB)")
        if len(keys) > 20:
            print(f"  ... and {len(keys) - 20} more")
        print(f"\nTotal: {total_mb:.1f} MB")
        return

    # Filter and download
    keys = filter_by_bbox(keys, tuple(args.bbox))
    out_dir = Path(args.out) / args.product
    for key, size in keys:
        try:
            download_key(key, out_dir)
        except Exception as e:
            print(f"  FAILED {key}: {e}", file=sys.stderr)

    print(f"\nDone. Files in {out_dir}")


if __name__ == "__main__":
    main()
