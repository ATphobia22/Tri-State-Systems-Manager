#!/usr/bin/env python3
"""
TSM Antecedent Precipitation Index.

Evaluates whether recent precipitation is drier/wetter than climatological
normal for a given location and date. Key input for flood forecasting —
wet antecedent conditions produce more runoff from the same rainfall.

Concept from: USACE Antecedent Precipitation Tool (APT)
  https://github.com/erdc/Antecedent-Precipitation-Tool
  jDeters-USACE/Antecedent-Precipitation-Tool (fork manually)

Method:
  1. Pull daily precipitation for the last 90 days at (lat, lon)
     Source: NOAA CPC Global Unified Gauge-Based Analysis (or GPM IMERG)
  2. Pull 30-year climatological normals for the same calendar window
     Source: PRISM normals or NOAA Climate Normals
  3. Compute percentile rank → classify conditions

Classification (per USACE APT methodology):
  - < 30th percentile: Drier than normal
  - 30th–70th percentile: Normal
  - > 70th percentile: Wetter than normal

Usage:
  python antecedent_precip.py --lat 37.8459 --lon -88.0051
  python antecedent_precip.py --lat 37.8459 --lon -88.0051 --days 30
"""

import argparse
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd


def get_recent_precip(lat: float, lon: float, days: int = 90) -> pd.DataFrame:
    """
    Get daily precipitation for the last N days at a point.
    Uses NOAA CPC gauge-based analysis via PSL.
    """
    # NOAA PSL CPC Global Daily Precipitation
    # https://psl.noaa.gov/data/gridded/data.cpc.globalprecip.html
    #
    # For operational use, replace with direct NetCDF access:
    #   url = "https://psl.noaa.gov/thredds/dodsC/Datasets/cpc_global_precip/precip.V1.0.2024.nc"
    #
    # Placeholder: returns empty — wire to actual data source
    print(f"  Fetching {days}d precipitation at ({lat}, {lon})...")
    print(f"  NOTE: wire to NOAA CPC or GPM IMERG NetCDF in production")
    return pd.DataFrame(columns=["date", "precip_mm"])


def get_climate_normals(lat: float, lon: float, month: int, day: int,
                        window_days: int = 90) -> pd.DataFrame:
    """
    Get 30-year climatological normals for a calendar window.
    Source: PRISM 30-year normals (1991-2020) or NOAA Climate Normals.
    """
    print(f"  Fetching climate normals for {month:02d}-{day:02d} ± {window_days//2}d...")
    print(f"  NOTE: wire to PRISM normals NetCDF in production")
    return pd.DataFrame(columns=["date", "normal_mm"])


def compute_api(precip: pd.DataFrame, days: int = 30) -> float:
    """
    Compute Antecedent Precipitation Index (API).
    Weighted sum with exponential decay — recent rain counts more.
    API = Σ P_i × k^i  where k=0.9, i=days ago
    """
    if precip.empty:
        return np.nan
    vals = precip["precip_mm"].to_numpy()[-days:]
    weights = 0.9 ** np.arange(len(vals) - 1, -1, -1)
    return float(np.sum(vals * weights))


def classify_conditions(percentile: float) -> str:
    """Classify per USACE APT thresholds."""
    if np.isnan(percentile):
        return "UNKNOWN"
    if percentile < 30:
        return "DRIER_THAN_NORMAL"
    elif percentile <= 70:
        return "NORMAL"
    else:
        return "WETTER_THAN_NORMAL"


def assess(lat: float, lon: float, days: int = 90):
    """Full antecedent precipitation assessment."""
    print(f"\nAntecedent Precipitation Assessment")
    print(f"Location: ({lat}, {lon})")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d')}")
    print(f"Window: {days} days\n")

    precip = get_recent_precip(lat, lon, days)
    api = compute_api(precip, days=30)

    # TODO: compute percentile against normals
    # percentile = ...

    print(f"30-day API: {api:.1f} mm (weighted)")
    print(f"Classification: see TODO — needs normals data")

    # What this means for flood forecasting
    print(f"\nFlood implications:")
    print(f"  - Wetter than normal → higher runoff ratio, lower infiltration")
    print(f"  - Feed API as covariate to OpenHydroNet / TimesFM")
    print(f"  - Critical for flash flood guidance")

    return {"api_mm": api, "lat": lat, "lon": lon}


def main():
    ap = argparse.ArgumentParser(description="TSM Antecedent Precipitation Index")
    ap.add_argument("--lat", type=float, required=True)
    ap.add_argument("--lon", type=float, required=True)
    ap.add_argument("--days", type=int, default=90)
    args = ap.parse_args()
    assess(args.lat, args.lon, args.days)


if __name__ == "__main__":
    main()
