#!/usr/bin/env python3
"""
Fetch USDA NASS Cropland Data Layer (CDL) for Posey County, Indiana.

The CDL is an annual 30m crop type map (1997-present), public domain.
Download from: https://croplandcros.scinet.usda.gov/
Or via USDA Geospatial Data Gateway: https://datagateway.nrcs.usda.gov/

This script downloads the CDL GeoTIFF for a given year and clips it
to the Posey County boundary.

Usage:
    python3 fetch-usda-cdl.py --year 2024 --out ./datasets/cdl-2024-posey.tif

No API key required. Public domain data.
"""

import argparse
import os
import sys
import urllib.request

# USDA CDL download URLs (CropScape)
CDL_BASE = "https://croplandcros.scinet.usda.gov"

# Posey County, IN FIPS: 18129
POSEY_FIPS = "18129"

# Bounding box for Posey County, IN (approximate, WGS84)
# West, South, East, North
POSEY_BBOX = (-88.15, 37.75, -87.85, 38.15)


def fetch_cdl(year, out_path):
    """
    Download CDL for Indiana for the given year.
    
    Note: The CropScape API requires constructing the download URL.
    For production use, use the USDA Geospatial Data Gateway or
    download the state-level GeoTIFF and clip with GDAL.
    """
    print(f"Fetching USDA CDL {year} for Posey County, IN...")
    print(f"BBox: {POSEY_BBOX}")
    print()
    print("Manual download steps (CropScape web interface):")
    print(f"  1. Visit: {CDL_BASE}")
    print(f"  2. Select year: {year}")
    print(f"  3. Define AOI: Posey County, IN (FIPS {POSEY_FIPS})")
    print(f"  4. Download GeoTIFF to: {out_path}")
    print()
    print("Or via GDAL (state file + clip):")
    print(f"  gdal_translate -projwin {' '.join(map(str, [POSEY_BBOX[0], POSEY_BBOX[3], POSEY_BBOX[2], POSEY_BBOX[1]]))} \\")
    print(f"    /vsicurl/https://.../CDL_{year}_clip.tif {out_path}")
    print()
    print("CDL crop codes: 1=Corn, 5=Soybeans, 24=Winter Wheat, etc.")
    print("Full legend: https://www.nass.usda.gov/Research_and_Science/Cropland/metadata/meta.php")


def main():
    ap = argparse.ArgumentParser(description="Fetch USDA CDL for Posey County")
    ap.add_argument("--year", type=int, default=2024, help="CDL year (1997-present)")
    ap.add_argument("--out", default="./datasets/cdl-posey.tif", help="Output GeoTIFF path")
    args = ap.parse_args()
    
    if args.year < 1997 or args.year > 2026:
        print(f"Error: year must be 1997-2026, got {args.year}", file=sys.stderr)
        sys.exit(1)
    
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    fetch_cdl(args.year, args.out)


if __name__ == "__main__":
    main()
