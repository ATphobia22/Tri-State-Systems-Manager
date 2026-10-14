#!/usr/bin/env python3
"""
Fetch USDA NASS Cropland Data Layer (CDL) for Posey County, Indiana.

The CDL is an annual 30m crop type map (1997-present), public domain.

NOTE: CropScape (nassgeodata.gmu.edu) is badly degraded as of 2026 —
the interactive tool requires sign-in and the API times out. This script
uses the Microsoft Planetary Computer STAC API instead, which serves
CDL as cloud-optimized GeoTIFFs in EPSG:5070.

Usage:
    python3 fetch-usda-cdl.py --year 2024 --out ./datasets/cdl-2024-posey.tif

No API key required. Public domain data.
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.parse

# Planetary Computer STAC API
PC_STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
CDL_COLLECTION = "usda-cdl"

# Posey County, IN FIPS: 18129
POSEY_FIPS = "18129"

# Bounding box for Posey County, IN (WGS84: west, south, east, north)
POSEY_BBOX = (-88.15, 37.75, -87.85, 38.15)


def search_cdl(year):
    """Search Planetary Computer STAC for CDL of the given year."""
    url = f"{PC_STAC_URL}/collections/{CDL_COLLECTION}/items"
    params = {
        "datetime": f"{year}-01-01T00:00:00Z/{year}-12-31T23:59:59Z",
        "bbox": ",".join(map(str, POSEY_BBOX)),
        "limit": 10,
    }
    full_url = f"{url}?{urllib.parse.urlencode(params)}"
    print(f"Searching: {full_url}", file=sys.stderr)

    req = urllib.request.Request(full_url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def fetch_cdl(year, out_path):
    """Download CDL for the given year, clipped to Posey County bbox."""
    print(f"Fetching USDA CDL {year} for Posey County, IN...", file=sys.stderr)

    results = search_cdl(year)
    features = results.get("features", [])

    if not features:
        print(f"No CDL items found for {year}", file=sys.stderr)
        print("Try: https://planetarycomputer.microsoft.com/dataset/usda-cdl", file=sys.stderr)
        sys.exit(1)

    item = features[0]
    assets = item.get("assets", {})

    download_url = None
    for name, asset in assets.items():
        href = asset.get("href", "")
        if href.endswith(".tif") or "cog" in name.lower() or "data" in name.lower():
            download_url = href
            break

    if not download_url:
        print("No GeoTIFF asset found in STAC item", file=sys.stderr)
        print(json.dumps(list(assets.keys()), indent=2), file=sys.stderr)
        sys.exit(1)

    print(f"Downloading: {download_url}", file=sys.stderr)
    print(f"To: {out_path}", file=sys.stderr)

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)

    def progress(block_num, block_size, total_size):
        if total_size > 0:
            pct = min(100, block_num * block_size * 100 // total_size)
            print(f"\r  {pct}% ({block_num * block_size // 1024 // 1024}MB)", end="", file=sys.stderr)

    urllib.request.urlretrieve(download_url, out_path, reporthook=progress)
    print(f"\nDone: {out_path}", file=sys.stderr)
    print()
    print("CDL crop codes: 1=Corn, 5=Soybeans, 24=Winter Wheat, etc.")
    print("Full legend: https://www.nass.usda.gov/Research_and_Science/Cropland/metadata/meta.php")


def main():
    ap = argparse.ArgumentParser(description="Fetch USDA CDL for Posey County via Planetary Computer")
    ap.add_argument("--year", type=int, default=2024, help="CDL year (1997-present)")
    ap.add_argument("--out", default="./datasets/cdl-posey.tif", help="Output GeoTIFF path")
    args = ap.parse_args()

    if args.year < 1997 or args.year > 2026:
        print(f"Error: year must be 1997-2026, got {args.year}", file=sys.stderr)
        sys.exit(1)

    fetch_cdl(args.year, args.out)


if __name__ == "__main__":
    main()
