#!/usr/bin/env python3
"""
TSM GEOGloWS Streamflow Integration.

Pulls operational streamflow forecasts from GEOGloWS v2 (BYU/NOAA/NASA)
for the Ohio and Wabash rivers. Third forecast source alongside
TimesFM (nowcasting) and OpenHydroNet (trained model).

Fork: https://github.com/ATphobia22/pygeoglows
Docs: https://geoglows.readthedocs.io

NOTE: pygeoglows.data.latlon_to_river() is broken in v2 (metadata table
no longer has lat/lon columns). River IDs must be found via the web app:
  https://apps.geoglows.org/ — click on the river, copy the LINKNO.

Known river IDs (verify via web app):
  Ohio River at Old Shawneetown: <find via apps.geoglows.org>
  Wabash River at New Harmony:   <find via apps.geoglows.org>

Usage:
  python geoglows_forecast.py --river-id 123456789 --days 10
"""

import argparse
from datetime import datetime
from pathlib import Path

import pandas as pd

OUT_DIR = Path("./geoglows-forecasts")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# River IDs — populate via https://apps.geoglows.org/
# Click on the Ohio River near Old Shawneetown, copy LINKNO
RIVERS = {
    # "ohio_old_shawneetown": 123456789,  # TODO: find via web app
    # "wabash_new_harmony": 987654321,    # TODO: find via web app
}


def get_forecast(river_id: int) -> pd.DataFrame:
    """Get 10-day ensemble streamflow forecast for a river ID."""
    import geoglows
    df = geoglows.data.forecast(river_id)
    return df


def get_retrospective(river_id: int) -> pd.DataFrame:
    """Get historical retrospective streamflow (for bias correction)."""
    import geoglows
    df = geoglows.data.retrospective(river_id)
    return df


def get_return_periods(river_id: int) -> pd.DataFrame:
    """Get flood return period thresholds (2, 5, 10, 25, 50, 100 year)."""
    import geoglows
    df = geoglows.data.return_periods(river_id)
    return df


def main():
    ap = argparse.ArgumentParser(description="TSM GEOGloWS forecast pull")
    ap.add_argument("--river-id", type=int, required=True, help="GEOGloWS LINKNO")
    ap.add_argument("--name", default="river", help="Label for output files")
    args = ap.parse_args()

    print(f"Fetching GEOGloWS forecast for river {args.river_id} ({args.name})...")

    # Forecast
    fc = get_forecast(args.river_id)
    print(f"  Forecast: {len(fc)} rows")
    print(f"  Columns: {list(fc.columns)[:5]}")

    stamp = datetime.now().strftime("%Y%m%dT%H%M%S")
    out = OUT_DIR / f"{args.name}_{args.river_id}_forecast_{stamp}.csv"
    fc.to_csv(out)
    print(f"  Saved: {out}")

    # Return periods (for flood threshold comparison)
    try:
        rp = get_return_periods(args.river_id)
        print(f"\n  Return periods:")
        print(rp.to_string())
    except Exception as e:
        print(f"  Return periods unavailable: {e}")


if __name__ == "__main__":
    if not RIVERS:
        print("No river IDs configured yet.")
        print("Find them at https://apps.geoglows.org/ — click on the river, copy LINKNO,")
        print("then add to RIVERS dict or use --river-id directly.")
    main()
