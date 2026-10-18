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


def filter_by_bbox(keys: list, bbox: tuple) -> list:
    """
    Filter tile keys by bounding box.
    TNM tiles are typically named with lat/lon or UTM grid references.
    This is a heuristic — check tile naming for the specific product.
    """
    # TODO: implement tile-name parsing per product
    # For now, return all (user filters manually or downloads all)
    print(f"  Note: bbox filtering not yet implemented for tile names,")
    print(f"  returning all {len(keys)} tiles. Filter manually as needed.")
    return keys


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
