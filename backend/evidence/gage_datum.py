"""Resilient gage-datum conversion: stage is not elevation.

Water Surface Elevation (ft NAVD88) = stage (ft) + gage datum (ft NAVD88),
computed ONLY after both datums are validated. This module never estimates,
interpolates, or substitutes a station altitude for a gage-zero conversion.

Resilient policy (fail-closed is banned by user directive): when a datum is
missing, unpublished, or invalid, the public function returns a result dict
with ``status`` ``UNAVAILABLE`` and ``wse_ft_navd88`` None, and the caller
keeps running. It never raises for a missing datum and never returns a
fabricated elevation.

Datum table: backend/governance/site_constants.py (parent-verified 2026-10-24).
See that module for the known 352.67-vs-352.71 discrepancy on 03378500.
"""

from __future__ import annotations

import math
from typing import Any

from backend.governance.site_constants import GAGE_DATUMS_FT_NAVD88

EXPECTED_VERTICAL_DATUM = "NAVD88"


def convert_stage_to_wse(
    station_id: str,
    stage_ft: float,
    *,
    vertical_datum: str = "NAVD88",
) -> dict[str, Any]:
    """Convert a gage stage to a NAVD88 water surface elevation, or UNAVAILABLE.

    Returns a dict with keys: status ("OK" | "UNAVAILABLE"), wse_ft_navd88
    (float | None), station_id, station_name, gage_datum_ft_navd88, stage_ft,
    reason. Non-finite stages are UNAVAILABLE, not errors.
    """
    base: dict[str, Any] = {
        "station_id": station_id,
        "stage_ft": stage_ft,
        "wse_ft_navd88": None,
    }
    if vertical_datum != EXPECTED_VERTICAL_DATUM:
        return {**base, "status": "UNAVAILABLE", "station_name": None,
                "gage_datum_ft_navd88": None,
                "reason": f"DATUM_MISMATCH: vertical datum '{vertical_datum}' is not NAVD88."}
    record = GAGE_DATUMS_FT_NAVD88.get(station_id)
    if record is None:
        return {**base, "status": "UNAVAILABLE", "station_name": None,
                "gage_datum_ft_navd88": None,
                "reason": f"GAGE_DATUM_UNAVAILABLE: no verified NAVD88 gage datum for station {station_id}."}
    station_name, datum = record
    if not isinstance(stage_ft, (int, float)) or not math.isfinite(float(stage_ft)):
        return {**base, "status": "UNAVAILABLE", "station_name": station_name,
                "gage_datum_ft_navd88": datum,
                "reason": "GAGE_HEIGHT_INVALID: stage is non-finite; no WSE computed."}
    return {**base, "status": "OK", "station_name": station_name,
            "gage_datum_ft_navd88": datum,
            "wse_ft_navd88": round(float(stage_ft) + datum, 3),
            "reason": "ok"}
