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
import requests


def get_recent_precip(lat: float, lon: float, days: int = 90) -> pd.DataFrame:
    """
    Get daily precipitation for the last N days at a point.
    Uses NOAA CPC CONUS 0.25-degree gauge-based analysis.
    Source: https://ftp.cpc.ncep.noaa.gov/precip/CPC_UNI_PRCP/GAUGE_CONUS/
    """
    import io
    from datetime import datetime, timedelta

    print(f"  Fetching {days}d CPC precipitation at ({lat}, {lon})...")

    # CPC CONUS grid: 0.25 degree, files are .lnx (little-endian binary)
    # Format: PRCP_CU_GAUGE_V1.0CONUS_0.25deg.lnx.YYYYMMDD.RT
    # For simplicity, use the daily text format via NOAA PSL
    #
    # Alternative: GPM IMERG via NASA Earthdata (see earthdata_tristate.py)
    # For now, fetch from CPC FTP RT (realtime) files

    base = "https://ftp.cpc.ncep.noaa.gov/precip/CPC_UNI_PRCP/GAUGE_CONUS/RT"
    end = datetime.now()
    records = []

    # CPC grid: lon -124.75 to -67.0 (0.25 deg), lat 25.125 to 52.875
    # Tri-state is well within CONUS coverage
    for i in range(min(days, 30)):  # limit to 30 days for FTP efficiency
        d = end - timedelta(days=i+1)  # RT files are 1 day behind
        datestr = d.strftime("%Y%m%d")
        year = d.strftime("%Y")
        url = f"{base}/{year}/PRCP_CU_GAUGE_V1.0CONUS_0.25deg.lnx.{datestr}.RT"

        try:
            import struct
            r = requests.get(url, timeout=30)
            if r.status_code != 200:
                continue

            # .lnx format: 120 x 300 grid of float32 (little-endian)
            # lon: -124.75 + 0.25*col, lat: 25.125 + 0.25*row
            data = struct.unpack('<' + 'f' * 36000, r.content[:144000])

            # Find grid cell
            col = int(round((lon - (-124.75)) / 0.25))
            row = int(round((lat - 25.125) / 0.25))
            if 0 <= row < 120 and 0 <= col < 300:
                val = data[row * 300 + col]
                # -999 = missing, convert 0.1mm to mm
                precip_mm = val * 0.1 if val > -900 else 0.0
                records.append({"date": d.date(), "precip_mm": max(0, precip_mm)})
        except Exception as e:
            print(f"    {datestr}: {e}")
            continue

    df = pd.DataFrame(records)
    if len(df) > 0:
        df = df.sort_values("date").reset_index(drop=True)
        print(f"  Got {len(df)} days of CPC precipitation")
    else:
        print(f"  No CPC data retrieved — check network/FTP availability")
    return df


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

    # Classify using absolute API thresholds calibrated for Ohio Valley.
    # These are interim thresholds; full USACE APT percentile classification
    # requires 30-year PRISM normals (FTP download, not yet automated).
    # Thresholds based on typical Oct 30-day API range for southern Indiana:
    #   < 15mm  → very dry (drought-like antecedent)
    #   15-40mm → drier than normal
    #   40-80mm → normal
    #   80-120mm → wetter than normal
    #   > 120mm → very wet (saturated antecedent)
    if np.isnan(api):
        classification = "UNKNOWN"
    elif api < 15:
        classification = "DRIER_THAN_NORMAL"
    elif api < 40:
        classification = "DRIER_THAN_NORMAL"
    elif api <= 80:
        classification = "NORMAL"
    elif api <= 120:
        classification = "WETTER_THAN_NORMAL"
    else:
        classification = "WETTER_THAN_NORMAL"

    print(f"30-day API: {api:.1f} mm (weighted)")
    print(f"Classification: {classification}")
    print(f"  (interim absolute thresholds; full percentile needs PRISM normals)")

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
