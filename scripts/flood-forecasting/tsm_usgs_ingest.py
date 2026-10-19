#!/usr/bin/env python3
"""USGS Water Data API ingestion adapters for TSM hydrology workflows.

Uses the modern dataretrieval.waterdata client only. The deprecated
dataretrieval.nwis / WaterServices path is intentionally not a fallback.
Raw stage (parameter 00065) remains in source gage datum; station altitude is
metadata and is never used as a gage-zero conversion.
"""
from __future__ import annotations

import math
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import pandas as pd

CONTINUOUS_API = "https://api.waterdata.usgs.gov/ogcapi/v1/collections/continuous/items"
DAILY_API = "https://api.waterdata.usgs.gov/ogcapi/v1/collections/daily/items"

_LENGTH_TO_FEET = {
    "ft": (1.0, "IDENTITY_FEET"),
    "foot": (1.0, "IDENTITY_FEET"),
    "feet": (1.0, "IDENTITY_FEET"),
    "m": (1.0 / 0.3048, "METRES_TO_FEET_EXACT"),
    "meter": (1.0 / 0.3048, "METRES_TO_FEET_EXACT"),
    "meters": (1.0 / 0.3048, "METRES_TO_FEET_EXACT"),
    "metre": (1.0 / 0.3048, "METRES_TO_FEET_EXACT"),
    "metres": (1.0 / 0.3048, "METRES_TO_FEET_EXACT"),
}
_DISCHARGE_TO_CFS = {
    "cfs": (1.0, "IDENTITY_CFS"),
    "ft3/s": (1.0, "IDENTITY_CFS"),
    "m3/s": (35.31466672148859, "CUBIC_METRES_PER_SECOND_TO_CFS_EXACT"),
    "l/s": (0.03531466672148859, "LITRES_PER_SECOND_TO_CFS_EXACT"),
}
_API_PROPERTIES = [
    "monitoring_location_id",
    "parameter_code",
    "time_series_id",
    "time",
    "value",
    "unit_of_measure",
    "approval_status",
    "qualifier",
]

# Station/land-surface altitude is separate from any gage-zero relationship.
GAGES = {
    "03381700": {
        "name": "Ohio River at Old Shawneetown, IL",
        "parameter": "00065",
        "station_altitude_ft_navd88": 309.10,
        "station_altitude_source_uri": "https://waterdata.usgs.gov/monitoring-location/USGS-03381700/",
        "gage_height_vertical_datum": "GAGE_DATUM",
        "gage_zero_navd88_ft": None,
    },
    "03378500": {
        "name": "Wabash River at New Harmony, IN",
        "parameter": "00065",
        "station_altitude_ft_navd88": 352.71,
        "station_altitude_ft_ngvd29": 353.07,
        "station_altitude_source_uri": "https://waterdata.usgs.gov/monitoring-location/USGS-03378500/",
        "gage_height_vertical_datum": "GAGE_DATUM",
        "gage_zero_navd88_ft_candidate": 352.67,
        "gage_zero_conversion_status": "UNVERIFIED_PRODUCT_SEMANTICS",
        "datum_ft": 352.71,
        "datum": "NAVD88",
    },
}


def _validate_query(site: str, parameter: str, days: int) -> None:
    if not isinstance(site, str) or not re.fullmatch(r"\d{5,15}", site):
        raise ValueError("site must be a numeric USGS monitoring-location ID")
    if not isinstance(parameter, str) or not re.fullmatch(r"\d{5}", parameter):
        raise ValueError("parameter must be a five-digit USGS parameter code")
    if isinstance(days, bool) or not isinstance(days, int) or not 1 <= days <= 1095:
        raise ValueError("days must be an integer from 1 to 1095 (maximum three years)")


def _iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _normalized_unit(unit: object) -> str:
    return str(unit).strip().casefold().replace(" ", "")


def _fetch_waterdata_series(
    site: str,
    parameter: str,
    days: int,
    *,
    collection: str,
) -> pd.DataFrame:
    """Fetch and validate a continuous or daily series from the official OGC API."""
    _validate_query(site, parameter, days)
    if collection not in {"continuous", "daily"}:
        raise ValueError("collection must be 'continuous' or 'daily'")

    try:
        from dataretrieval import waterdata
    except ImportError as exc:
        raise ImportError(
            "Install a current dataretrieval package with dataretrieval.waterdata; "
            "the deprecated NWIS client is not used as a fallback."
        ) from exc

    getter_name = "get_continuous" if collection == "continuous" else "get_daily"
    getter = getattr(waterdata, getter_name, None)
    if not callable(getter):
        raise RuntimeError(
            f"Installed dataretrieval.waterdata does not expose {getter_name}; "
            "upgrade dataretrieval rather than falling back to legacy NWIS."
        )

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    if collection == "continuous":
        time_range = f"{_iso_utc(start)}/{_iso_utc(end)}"
        source_uri = CONTINUOUS_API
    else:
        time_range = f"{start.date().isoformat()}/{end.date().isoformat()}"
        source_uri = DAILY_API

    frame, metadata = getter(
        monitoring_location_id=f"USGS-{site}",
        parameter_code=parameter,
        time=time_range,
        properties=_API_PROPERTIES,
    )
    if not isinstance(frame, pd.DataFrame):
        raise TypeError(f"USGS Water Data {collection} response was not a pandas DataFrame")
    if frame.empty:
        raise ValueError(
            f"No {collection} observations returned for USGS-{site} parameter {parameter}"
        )

    required = {"time", "value", "unit_of_measure"}
    missing = sorted(required.difference(frame.columns))
    if missing:
        raise ValueError(
            f"USGS Water Data {collection} response is missing required fields: {missing}"
        )

    times = pd.to_datetime(frame["time"], utc=True, errors="coerce")
    values = pd.to_numeric(frame["value"], errors="coerce")
    units = frame["unit_of_measure"].astype("string").str.strip()
    finite = values.map(lambda value: pd.notna(value) and math.isfinite(float(value)))
    valid = times.notna() & finite & values.ne(-999) & units.notna() & units.ne("")
    if not bool(valid.any()):
        raise ValueError(
            f"No usable {collection} observations returned for USGS-{site} parameter {parameter}"
        )

    def source_column(name: str, default: object) -> pd.Series:
        return frame[name] if name in frame.columns else pd.Series(default, index=frame.index)

    out = pd.DataFrame({
        "datetime": times.loc[valid].reset_index(drop=True),
        "value": values.loc[valid].astype(float).reset_index(drop=True),
        "unit_of_measure": units.loc[valid].reset_index(drop=True),
        "approval_status": source_column("approval_status", pd.NA).loc[valid].reset_index(drop=True),
        "qualifier": source_column("qualifier", pd.NA).loc[valid].reset_index(drop=True),
        "time_series_id": source_column("time_series_id", pd.NA).loc[valid].reset_index(drop=True),
    })
    out["parameter_code"] = parameter
    out["monitoring_location_id"] = f"USGS-{site}"
    source_url = getattr(metadata, "url", None)
    out["source_uri"] = str(source_url) if isinstance(source_url, str) and source_url else source_uri
    out["retrieved_at"] = _iso_utc(datetime.now(timezone.utc))
    out = out.sort_values("datetime").reset_index(drop=True)

    # Never choose an arbitrary row when two time series overlap in time.
    if out["datetime"].duplicated(keep=False).any():
        raise ValueError(
            f"Ambiguous duplicate timestamps for USGS-{site} parameter {parameter}; "
            "select a specific time_series_id before ingestion."
        )
    return out


def get_continuous_values(
    site: str,
    days: int = 30,
    parameter: str = "00065",
) -> pd.DataFrame:
    """Return continuous USGS observations with units, times and quality metadata."""
    return _fetch_waterdata_series(site, parameter, days, collection="continuous")


def get_gage_height(site: str, days: int = 30, parameter: Optional[str] = None) -> pd.DataFrame:
    """Fetch parameter 00065 and normalize only the length unit to feet.

    No vertical-datum conversion is applied. The returned value_ft remains on
    source gage datum; station altitude is never a gage-zero substitute.
    """
    selected_parameter = parameter or "00065"
    if selected_parameter != "00065":
        raise ValueError(
            "get_gage_height only accepts parameter 00065; "
            "use get_continuous_values for other parameter codes."
        )

    raw = get_continuous_values(site, days=days, parameter=selected_parameter).copy()
    source_units = raw["unit_of_measure"].map(_normalized_unit)
    conversions = source_units.map(lambda unit: _LENGTH_TO_FEET.get(unit))
    unknown = conversions.isna()
    if bool(unknown.any()):
        unsupported = sorted(set(raw.loc[unknown, "unit_of_measure"].astype(str)))
        raise ValueError(f"Unsupported USGS gage-height length units: {unsupported}")

    raw["source_value"] = raw["value"]
    raw["source_unit"] = raw["unit_of_measure"]
    raw["unit_conversion"] = conversions.map(lambda conversion: conversion[1])
    raw["value_ft"] = [
        float(value) * conversion[0]
        for value, conversion in zip(raw["source_value"], conversions, strict=True)
    ]
    raw["unit_of_measure"] = "ft"
    return raw.drop(columns=["value"]).reset_index(drop=True)


def get_daily_discharge(site: str, days: int = 365) -> pd.DataFrame:
    """Fetch daily USGS discharge values, preserving original units and quality."""
    raw = _fetch_waterdata_series(site, "00060", days, collection="daily").copy()
    source_units = raw["unit_of_measure"].map(_normalized_unit)
    source_units = source_units.str.replace("³", "3", regex=False).str.replace("^", "", regex=False)
    conversions = source_units.map(lambda unit: _DISCHARGE_TO_CFS.get(unit))
    unknown = conversions.isna()
    if bool(unknown.any()):
        unsupported = sorted(set(raw.loc[unknown, "unit_of_measure"].astype(str)))
        raise ValueError(f"Unsupported USGS discharge units: {unsupported}")

    raw["source_value"] = raw["value"]
    raw["source_unit"] = raw["unit_of_measure"]
    raw["unit_conversion"] = conversions.map(lambda conversion: conversion[1])
    raw["value_cfs"] = [
        float(value) * conversion[0]
        for value, conversion in zip(raw["source_value"], conversions, strict=True)
    ]
    return raw.drop(columns=["value"]).reset_index(drop=True)


if __name__ == "__main__":
    for site in GAGES:
        df = get_gage_height(site, days=7)
        print(f"{site} ({GAGES[site]['name']}):")
        print(f"  {len(df)} records, latest: {df['value_ft'].iloc[-1]:.2f} ft")
        print(f"  Observed at {df['datetime'].iloc[-1]} — {df['approval_status'].iloc[-1]}")
        print(f"  Source datum: {GAGES[site]['gage_height_vertical_datum']}; no WSE conversion applied")
