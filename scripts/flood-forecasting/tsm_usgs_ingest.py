#!/usr/bin/env python3
"""
TSM USGS Data Ingestion — official dataretrieval-python integration.

Replaces hand-rolled USGS API calls with the USGS-maintained client.
Used by timesfm-gage-nowcast.py and any other module needing gage data.

Fork: https://github.com/ATphobia22/dataretrieval-python
Upstream: https://github.com/DOI-USGS/dataretrieval-python
"""

from datetime import datetime, timedelta
from typing import Optional

import pandas as pd

# TSM gage registry
GAGES = {
    "03381700": {
        "name": "Ohio River at Old Shawneetown, IL",
        "parameter": "00065",  # gage height, ft, raw source gage datum
        "station_altitude_ft_navd88": 309.10,
        "station_altitude_source_uri": "https://waterdata.usgs.gov/monitoring-location/USGS-03381700/",
        "gage_height_vertical_datum": "GAGE_DATUM",
        "gage_zero_navd88_ft": None,
    },
    "03378500": {
        "name": "Wabash River at New Harmony, IN",
        "parameter": "00065",  # raw stage remains source gage datum
        "station_altitude_ft_navd88": 352.71,
        "station_altitude_ft_ngvd29": 353.07,
        "station_altitude_source_uri": "https://waterdata.usgs.gov/monitoring-location/USGS-03378500/",
        "gage_height_vertical_datum": "GAGE_DATUM",
        "gage_zero_navd88_ft_candidate": 352.67,
        "gage_zero_conversion_status": "UNVERIFIED_PRODUCT_SEMANTICS",
    },
}


def get_gage_height(
    site: str,
    days: int = 30,
    parameter: Optional[str] = None,
) -> pd.DataFrame:
    """
    Fetch gage height time series from USGS NWIS.

    Returns DataFrame with columns: datetime, value_ft
    """
    try:
        import dataretrieval.nwis as nwis
    except ImportError:
        raise ImportError("pip install dataretrieval")

    cfg = GAGES.get(site, {})
    param = parameter or cfg.get("parameter", "00065")

    end = datetime.now()
    start = end - timedelta(days=days)

    # Use the new waterdata API (nwis.get_record is deprecated)
    try:
        import dataretrieval.waterdata as wd
        df = wd.get_iv(
            sites=site,
            parameterCd=param,
            start=start.strftime("%Y-%m-%d"),
            end=end.strftime("%Y-%m-%d"),
        )
    except (ImportError, AttributeError):
        # Fallback to legacy nwis API
        import dataretrieval.nwis as nwis
        df, _ = nwis.get_iv(
            sites=site,
            parameterCd=param,
            startDt=start.strftime("%Y-%m-%d"),
            endDt=end.strftime("%Y-%m-%d"),
        )

    # Normalize columns
    df = df.reset_index()
    # Find datetime and value columns
    dt_col = next((c for c in df.columns if "datetime" in c.lower()), None)
    val_col = next(
        (c for c in df.columns if param in str(c) and "cd" not in str(c).lower()),
        None,
    )
    if not dt_col or not val_col:
        raise ValueError(f"Could not find datetime/value columns in NWIS response")

    out = pd.DataFrame({
        "datetime": pd.to_datetime(df[dt_col]),
        "value_ft": pd.to_numeric(df[val_col], errors="coerce"),
    }).dropna().sort_values("datetime").reset_index(drop=True)

    return out


def get_daily_discharge(site: str, days: int = 365) -> pd.DataFrame:
    """Fetch daily mean discharge (00060) for a gage."""
    return get_gage_height(site, days=days, parameter="00060")


if __name__ == "__main__":
    for site in GAGES:
        df = get_gage_height(site, days=7)
        print(f"{site} ({GAGES[site]['name']}):")
        print(f"  {len(df)} records, latest: {df['value_ft'].iloc[-1]:.2f} ft")
        print(f"  Range: {df['datetime'].min()} → {df['datetime'].max()}")
