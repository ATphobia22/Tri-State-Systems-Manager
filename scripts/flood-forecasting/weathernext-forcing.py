#!/usr/bin/env python3
"""
TSM WeatherNext Forcing Connector — Layer 3 of the flood forecasting integration.

Pulls precipitation and 2m temperature forecasts from WeatherNext 2 data feeds
to use as dynamic meteorological forcing for OpenHydroNet.

WeatherNext 2 outputs are available as pre-computed data feeds (no need to run
the model). See: https://developers.google.com/weathernext/guides/access-forecast

For TSM's purposes, we extract:
  - total_precipitation_6hr  → aggregated to daily precipitation (mm/day)
  - temperature_2m           → daily mean, min, max (°C)

Output: NetCDF/Zarr compatible with OpenHydroNet forcings_dir

Prereqs:
  pip install xarray zarr gcsfs pandas numpy

Usage:
  python weathernext-forcing.py --bbox -88.7 37.6 -87.2 38.5 --days 7
"""

import argparse
from datetime import datetime, timedelta
from pathlib import Path

TRISTATE_BBOX = (-88.7, 37.6, -87.2, 38.5)  # min_lon, min_lat, max_lon, max_lat

OUT_DIR = Path("./data/tsm-forcings")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def fetch_weathernext_forecast(bbox, days: int = 7):
    """
    Fetch WeatherNext 2 forecast for the tri-state bbox.

    Data feeds are published to Google Cloud Storage. The exact bucket paths
    are documented at:
      https://developers.google.com/weathernext/guides/access-forecast

    This function uses xarray to open the Zarr store and subset to our bbox.
    """
    import xarray as xr

    # WeatherNext 2 forecast data feed (update path from docs if changed)
    # Published daily; check the access guide for the current bucket
    zarr_url = "gs://weathernext-forecasts/wn2/latest.zarr"

    print(f"Opening WeatherNext 2 forecast: {zarr_url}")
    ds = xr.open_zarr(
        zarr_url,
        storage_options={"token": "anon"},  # public bucket
    )

    # Subset to tri-state bbox
    min_lon, min_lat, max_lon, max_lat = bbox
    sub = ds.sel(
        longitude=slice(min_lon, max_lon),
        latitude=slice(max_lat, min_lat),  # lat usually descending
    )

    # Limit to requested forecast horizon
    if "time" in sub.dims:
        sub = sub.isel(time=slice(0, days * 4))  # 6-hourly → daily

    return sub


def to_daily_forcing(ds):
    """Aggregate 6-hourly WeatherNext output to daily forcing variables."""
    import xarray as xr

    daily = xr.Dataset()

    # Precipitation: sum 6-hourly totals → daily mm
    if "total_precipitation_6hr" in ds:
        # Resample to daily sum
        precip = ds["total_precipitation_6hr"].resample(time="1D").sum()
        daily["precip_mm_day"] = precip
        print(f"  precipitation: {precip.shape}")

    # Temperature: daily mean/min/max
    if "temperature_2m" in ds:
        t2m = ds["temperature_2m"]
        daily["tmean_c"] = t2m.resample(time="1D").mean()
        daily["tmin_c"] = t2m.resample(time="1D").min()
        daily["tmax_c"] = t2m.resample(time="1D").max()
        print(f"  temperature: {t2m.shape}")

    return daily


def main():
    ap = argparse.ArgumentParser(description="TSM WeatherNext forcing connector")
    ap.add_argument("--bbox", nargs=4, type=float, default=list(TRISTATE_BBOX),
                    metavar=("MIN_LON", "MIN_LAT", "MAX_LON", "MAX_LAT"))
    ap.add_argument("--days", type=int, default=7, help="Forecast horizon in days")
    ap.add_argument("--out", default=str(OUT_DIR / "weathernext_forcing.zarr"))
    args = ap.parse_args()

    print(f"WeatherNext forcing: bbox={args.bbox}, days={args.days}")

    try:
        ds = fetch_weathernext_forecast(tuple(args.bbox), args.days)
        daily = to_daily_forcing(ds)

        out_path = Path(args.out)
        print(f"Writing {out_path} ...")
        daily.to_zarr(out_path, mode="w")
        print("Done.")

    except Exception as e:
        print(f"\nFAILED: {e}")
        print("\nIf the GCS bucket path has changed, check:")
        print("  https://developers.google.com/weathernext/guides/access-forecast")
        print("\nFallback: use NOAA GFS via NOMADS for precipitation/temperature forcing.")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
