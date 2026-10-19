#!/usr/bin/env python3
"""
TSM TimesFM Gage Nowcasting — Layer 1 of the flood forecasting integration.

Uses Google's TimesFM 3.0 (zero-shot time series foundation model) to forecast
river levels at the three tri-state gages. No training required.

Gages:
  03381700  Ohio River at Old Shawneetown, IL  (USGS)
  03378500  Wabash River at New Harmony, IN    (USGS)
  MTVI3     Mount Vernon, IN                   (NWS/NOAA)

Prereqs:
  pip install torch transformers pandas numpy requests

  TimesFM 3.0 checkpoint downloads automatically from HuggingFace:
  google/timesfm-3.0-pytorch

Usage:
  python timesfm-gage-nowcast.py --hours 48
  python timesfm-gage-nowcast.py --hours 48 --gage 03381700
"""

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import requests

# ---------------------------------------------------------------------------
# Gage configuration
# ---------------------------------------------------------------------------

GAGES = {
    "03381700": {
        "name": "Ohio River at Old Shawneetown, IL",
        "source": "usgs",
        "parameter": "00065",  # raw gage height, feet in source gage datum
        "station_altitude_ft_navd88": 309.10,
        "station_altitude_source_uri": "https://waterdata.usgs.gov/monitoring-location/USGS-03381700/",
        "gage_height_vertical_datum": "GAGE_DATUM",
        "gage_zero_navd88_ft": None
    },
    "03378500": {
        "name": "Wabash River at New Harmony, IN",
        "source": "usgs",
        "parameter": "00065",
        "station_altitude_ft_navd88": 352.71,
        "station_altitude_ft_ngvd29": 353.07,
        "station_altitude_source_uri": "https://waterdata.usgs.gov/monitoring-location/USGS-03378500/",
        "gage_height_vertical_datum": "GAGE_DATUM",
        "gage_zero_navd88_ft_candidate": 352.67,
        "gage_zero_conversion_status": "UNVERIFIED_PRODUCT_SEMANTICS"
    },
    "MTVI3": {
        "name": "Mount Vernon, IN (Ohio River)",
        "source": "nws",
        "flood_stage_ft": 35.0,
    },
}

OUT_DIR = Path("./timesfm-forecasts")


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------

def fetch_usgs_gage(site: str, parameter: str, days: int = 30) -> pd.DataFrame:
    """Fetch source-stamped USGS series from the modern Water Data API.

    Parameter 00065 is normalized to feet but remains on source gage datum.
    Observation approval, qualifier, source URI, and units are retained.
    """
    try:
        from tsm_usgs_ingest import get_continuous_values, get_gage_height
    except ImportError:
        get_continuous_values = None
        get_gage_height = None

    if parameter == "00065" and get_gage_height is not None:
        frame = get_gage_height(site, days=days).rename(columns={"value_ft": "value"})
    elif get_continuous_values is not None:
        frame = get_continuous_values(site, days=days, parameter=parameter)
    else:
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=days)
        url = "https://api.waterdata.usgs.gov/ogcapi/v1/collections/continuous/items"
        params = {
            "f": "json",
            "monitoring_location_id": f"USGS-{site}",
            "parameter_code": parameter,
            "time": f"{start.isoformat()}/{end.isoformat()}",
            "limit": 10000,
        }
        api_key = os.getenv("USGS_WATERDATA_API_KEY")
        if api_key:
            params["api_key"] = api_key

        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        payload = response.json()
        features = payload.get("features")
        if not isinstance(features, list):
            raise ValueError("USGS Water Data API response has no features array")

        retrieved_at = datetime.now(timezone.utc).isoformat()
        response_url = getattr(response, "url", None)
        source_uri = response_url if isinstance(response_url, str) else str(url)
        records = []
        observed_units = set()
        for feature in features:
            properties = feature.get("properties", {})
            raw_time = properties.get("time")
            raw_value = properties.get("value")
            unit = properties.get("unit_of_measure")
            if raw_time is None or raw_value is None or unit is None:
                continue
            try:
                value = float(raw_value)
            except (TypeError, ValueError):
                continue
            if not np.isfinite(value) or value == -999:
                continue
            normalized_unit = str(unit).strip().lower()
            if parameter == "00065":
                if normalized_unit not in {"ft", "foot", "feet"}:
                    raise ValueError(
                        "USGS gage-height parameter 00065 must be in feet on the direct API path; "
                        f"received {unit!r}. Use the installed adapter for explicit unit conversion."
                    )
                normalized_unit = "ft"
            observed_units.add(normalized_unit)
            records.append({
                "datetime": pd.to_datetime(raw_time, utc=True),
                "value": value,
                "unit_of_measure": normalized_unit,
                "approval_status": properties.get("approval_status"),
                "qualifier": properties.get("qualifier"),
                "source_uri": source_uri,
                "retrieved_at": retrieved_at,
            })

        if not records:
            raise ValueError(f"No valid continuous observations returned for USGS site {site}")
        if len(observed_units) != 1:
            raise ValueError(
                f"USGS site {site} returned missing or inconsistent units: {sorted(observed_units)}"
            )
        frame = pd.DataFrame(records).sort_values("datetime").reset_index(drop=True)
        if frame["datetime"].duplicated(keep=False).any():
            raise ValueError(
                f"Ambiguous duplicate timestamps for USGS-{site} parameter {parameter}; "
                "select a specific time series before forecasting."
            )

    required = {"datetime", "value", "unit_of_measure", "approval_status", "qualifier", "source_uri", "retrieved_at"}
    missing = required.difference(frame.columns)
    if missing:
        raise ValueError(f"USGS adapter is missing fields required for provenance: {sorted(missing)}")
    return (
        frame[["datetime", "value", "unit_of_measure", "approval_status", "qualifier", "source_uri", "retrieved_at"]]
        .dropna(subset=["datetime", "value"])
        .sort_values("datetime")
        .reset_index(drop=True)
)



def fetch_nws_gage(gage_id: str, days: int = 30) -> pd.DataFrame:
    """Fetch recent stage from NWS API (for MTVI3-type gages)."""
    # NWS water API: https://api.water.noaa.gov/nwps/v1/gauges/{id}/stageflow
    url = f"https://api.water.noaa.gov/nwps/v1/gauges/{gage_id}"
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    info = r.json()

    # Get observed time series
    ts_url = f"https://api.water.noaa.gov/nwps/v1/gauges/{gage_id}/stageflow"
    r = requests.get(ts_url, timeout=60)
    r.raise_for_status()
    data = r.json()

    records = []
    for obs in data.get("observed", []):
        records.append({
            "datetime": pd.to_datetime(obs["validTime"]),
            "value": float(obs["primary"]),
        })
    df = pd.DataFrame(records).dropna().sort_values("datetime")
    # Filter to last N days
    cutoff = datetime.utcnow() - timedelta(days=days)
    df = df[df["datetime"] >= pd.Timestamp(cutoff, tz="UTC").tz_convert(None)]
    return df


def fetch_gage(gage_id: str, days: int = 30) -> pd.DataFrame:
    cfg = GAGES[gage_id]
    print(f"Fetching {gage_id}: {cfg['name']} ...")
    if cfg["source"] == "usgs":
        return fetch_usgage(gage_id, cfg["parameter"], days)
    else:
        return fetch_nws_gage(gage_id, days)


def fetch_usgage(site: str, parameter: str, days: int) -> pd.DataFrame:
    return fetch_usgs_gage(site, parameter, days)


# ---------------------------------------------------------------------------
# TimesFM forecasting
# ---------------------------------------------------------------------------

def run_timesfm_forecast(values: np.ndarray, horizon: int) -> np.ndarray:
    """
    Run TimesFM 3.0 zero-shot forecast.

    values: 1D array of historical observations (hourly or regular interval)
    horizon: number of future steps to predict
    returns: 1D array of forecasted values
    """
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    model_id = "google/timesfm-3.0-pytorch"
    print(f"Loading {model_id} ...")

    # TimesFM 3.0 via HuggingFace transformers
    # Note: exact API may vary — check the timesfm repo README for updates
    try:
        from timesfm import TimesFm
        model = TimesFm.from_pretrained(model_id)
        freq = [0] * len(values)  # 0 = high frequency (hourly)
        point_forecast, _ = model.forecast(
            horizon=horizon,
            inputs=[values.tolist()],
            freq=freq,
        )
        return np.array(point_forecast[0])
    except ImportError:
        print("timesfm package not found, trying transformers path...", file=sys.stderr)
        raise


def resample_hourly(df: pd.DataFrame) -> pd.DataFrame:
    """Resample to regular hourly intervals, forward-filling short gaps."""
    df = df.set_index("datetime").sort_index()
    df = df[~df.index.duplicated(keep="last")]
    hourly = df.resample("1H").mean()
    # Fill gaps up to 6 hours; longer gaps break the series
    hourly["value"] = hourly["value"].interpolate(limit=6)
    hourly = hourly.dropna()
    return hourly.reset_index()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def forecast_gage(gage_id: str, horizon_hours: int = 48, history_days: int = 30):
    cfg = GAGES[gage_id]

    # 1. Fetch history
    df = fetch_gage(gage_id, days=history_days)
    print(f"  Got {len(df)} observations from {df['datetime'].min()} to {df['datetime'].max()}")

    # 2. Resample to hourly
    hourly = resample_hourly(df)
    print(f"  Resampled to {len(hourly)} hourly points")
    if len(hourly) < 168:
        print(f"  WARNING: less than 7 days of hourly data — forecast quality reduced",
              file=sys.stderr)

    values = hourly["value"].to_numpy(dtype=np.float32)
    last_time = hourly["datetime"].iloc[-1]

    # 3. Forecast
    print(f"  Running TimesFM forecast for {horizon_hours}h ...")
    forecast = run_timesfm_forecast(values, horizon_hours)

    # 4. Build output
    future_times = [last_time + timedelta(hours=h + 1) for h in range(horizon_hours)]
    out = pd.DataFrame({
        "datetime": future_times,
        "forecast_ft": forecast,
        "gage_id": gage_id,
        "gage_name": cfg["name"],
    })

    # 5. Save
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_path = OUT_DIR / f"{gage_id}_forecast_{stamp}.csv"
    out.to_csv(out_path, index=False)
    print(f"  Saved: {out_path}")

    # 6. Summary
    current = values[-1]
    peak = forecast.max()
    print(f"\n  {gage_id} ({cfg['name']})")
    print(f"  Current: {current:.2f} ft  →  {horizon_hours}h peak forecast: {peak:.2f} ft")
    if "flood_stage_ft" in cfg and peak >= cfg["flood_stage_ft"]:
        print(f"  ⚠️  FORECAST EXCEEDS FLOOD STAGE ({cfg['flood_stage_ft']} ft)")
    return out


def main():
    ap = argparse.ArgumentParser(description="TSM TimesFM gage nowcasting")
    ap.add_argument("--hours", type=int, default=48, help="Forecast horizon in hours")
    ap.add_argument("--gage", choices=list(GAGES), help="Single gage (default: all)")
    ap.add_argument("--days", type=int, default=30, help="History window in days")
    args = ap.parse_args()

    gages = [args.gage] if args.gage else list(GAGES)
    for gid in gages:
        try:
            forecast_gage(gid, args.hours, args.days)
        except Exception as e:
            print(f"FAILED {gid}: {e}", file=sys.stderr)
        print()


if __name__ == "__main__":
    main()
