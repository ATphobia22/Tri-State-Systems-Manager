#!/usr/bin/env python3
"""
TSM NASA Earthdata Integration via earthaccess.

Search, download, and stream NASA Earth science data for the tri-state area.
Official client: https://github.com/nasa/earthaccess
Fork: https://github.com/ATphobia22/earthaccess

Requires NASA Earthdata login (free at https://urs.earthdata.nasa.gov).
Set EARTHDATA_USERNAME and EARTHDATA_PASSWORD env vars, or use netrc.

Relevant datasets for TSM flood work:
  - GPM IMERG: precipitation (half-hourly, 0.1°)
  - Landsat 8/9: optical imagery for flood extent
  - Sentinel-1: SAR for flood mapping (via ASF DAAC)
  - SRTM: elevation (30m global)
  - MODIS/VIIRS: daily imagery, flood products

Usage:
  python earthdata_tristate.py --dataset GPM --days 7
  python earthdata_tristate.py --dataset Landsat --bbox -88.7 37.6 -87.2 38.5
"""

import argparse
import os
from datetime import datetime, timedelta
from pathlib import Path

TRISTATE_BBOX = (-88.7, 37.6, -87.2, 38.5)  # min_lon, min_lat, max_lon, max_lat

OUT_DIR = Path("./earthdata-downloads")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Key dataset short names in NASA CMR
DATASETS = {
    "GPM": "GPM_3IMERGHH",           # Half-hourly precipitation
    "GPM_daily": "GPM_3IMERGDF",      # Daily precipitation
    "Landsat8": "LANDSAT_OT_C2_L2",   # Landsat 8/9 Collection 2 Level 2
    "SRTM": "SRTMGL1",                # 30m elevation
    "MODIS_flood": "MOD09A1",         # 8-day surface reflectance (flood detection)
    "VIIRS_flood": "VNP09H1",         # VIIRS surface reflectance
    "Sentinel1": "S1A_IW_SLC",        # Sentinel-1 SAR (via ASF)
}


def login():
    """Authenticate with NASA Earthdata."""
    import earthaccess
    auth = earthaccess.login(strategy="environment")
    if not auth.authenticated:
        print("Earthdata login failed. Set EARTHDATA_USERNAME and EARTHDATA_PASSWORD,")
        print("or create ~/.netrc with urs.earthdata.nasa.gov credentials.")
        print("Register free at https://urs.earthdata.nasa.gov/")
        raise SystemExit(1)
    print("Authenticated with NASA Earthdata")
    return auth


def search_dataset(short_name: str, bbox: tuple, days: int = 7):
    """Search CMR for granules matching dataset, bbox, and time range."""
    import earthaccess

    end = datetime.now()
    start = end - timedelta(days=days)

    results = earthaccess.search_data(
        short_name=short_name,
        bounding_box=bbox,
        temporal=(start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")),
    )
    print(f"Found {len(results)} granules for {short_name}")
    return results


def download_granules(results, out_dir: Path, max_downloads: int = 5):
    """Download granules (limited to max_downloads)."""
    import earthaccess

    out_dir.mkdir(parents=True, exist_ok=True)
    downloaded = earthaccess.download(results[:max_downloads], str(out_dir))
    print(f"Downloaded {len(downloaded)} files to {out_dir}")
    return downloaded


def main():
    ap = argparse.ArgumentParser(description="TSM NASA Earthdata client")
    ap.add_argument("--dataset", choices=list(DATASETS), default="GPM",
                    help="NASA dataset short name key")
    ap.add_argument("--bbox", nargs=4, type=float, default=list(TRISTATE_BBOX))
    ap.add_argument("--days", type=int, default=7, help="Days back to search")
    ap.add_argument("--download", action="store_true", help="Download granules")
    ap.add_argument("--max", type=int, default=5, help="Max granules to download")
    args = ap.parse_args()

    login()

    short_name = DATASETS[args.dataset]
    print(f"Dataset: {args.dataset} ({short_name})")
    print(f"Bbox: {args.bbox}, Days: {args.days}")

    results = search_dataset(short_name, tuple(args.bbox), args.days)

    if not results:
        print("No granules found. Try a different dataset or wider bbox/days.")
        return

    # Print first few
    for r in results[:5]:
        print(f"  {r['meta']['concept-id']}: {r['umm']['TemporalExtent']}")

    if args.download:
        out = OUT_DIR / args.dataset
        download_granules(results, out, args.max)


if __name__ == "__main__":
    main()
