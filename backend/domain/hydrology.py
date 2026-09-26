"""Fail-closed hydrologic domain transformations for TSM.

Raw USGS gage height is not a NAVD88 elevation. A WSE conversion is only
authoritative when a station-specific, published and validated gage-zero
elevation is supplied by the caller.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class GageObservation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    station_id: str = Field(min_length=1)
    observation_time: str
    stage_ft: float
    source_datum: Literal["USGS_GAGE_HEIGHT"]

    @field_validator("observation_time")
    @classmethod
    def validate_observation_time(cls, value: str) -> str:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return value


class DerivedWSEResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    station_id: str
    observation_time: str
    source_stage_ft: float
    wse_navd88_ft: Optional[float]
    validated_gage_zero_navd88: Optional[float]
    datum_status: Literal[
        "FAIL_CLOSED_MISSING_GAGE_ZERO",
        "VALIDATED_CONVERSION",
    ]
    bfe_clearance_ft: Optional[float]
    disclaimer: str = (
        "Calculation is an engineering estimate, not a formal regulatory determination."
    )


def calculate_wse_navd88(
    obs: GageObservation,
    validated_gage_zero_navd88: Optional[float],
    reference_bfe_navd88: Optional[float] = None,
) -> DerivedWSEResult:
    """Convert station gage height to NAVD88 WSE only with a validated gage zero."""
    if validated_gage_zero_navd88 is None:
        return DerivedWSEResult(
            station_id=obs.station_id,
            observation_time=obs.observation_time,
            source_stage_ft=obs.stage_ft,
            wse_navd88_ft=None,
            validated_gage_zero_navd88=None,
            datum_status="FAIL_CLOSED_MISSING_GAGE_ZERO",
            bfe_clearance_ft=None,
        )

    wse_navd88 = obs.stage_ft + validated_gage_zero_navd88
    clearance = (
        wse_navd88 - reference_bfe_navd88
        if reference_bfe_navd88 is not None
        else None
    )

    return DerivedWSEResult(
        station_id=obs.station_id,
        observation_time=obs.observation_time,
        source_stage_ft=obs.stage_ft,
        wse_navd88_ft=round(wse_navd88, 2),
        validated_gage_zero_navd88=validated_gage_zero_navd88,
        datum_status="VALIDATED_CONVERSION",
        bfe_clearance_ft=round(clearance, 2),
    )
