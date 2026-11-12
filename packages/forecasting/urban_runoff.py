"""Non-calibrated urban roof runoff / green roof screening.

Inspired by general SpongeKit-style SuDS concepts; no upstream source copied.
Not a HEC-HMS / HEC-RAS hydraulic or forecasting solver.
All input units must be explicit (m², mm, m³).
"""
from __future__ import annotations
from dataclasses import dataclass, asdict
import math

@dataclass(frozen=True)
class ScreeningInput:
    roof_area_m2: float
    rainfall_depth_mm: float
    impervious_runoff_coefficient: float
    green_roof_fraction: float
    green_roof_storage_mm: float
    green_roof_runoff_coefficient: float
    source_evidence_id: str

def screen(input: ScreeningInput) -> dict:
    values = [input.roof_area_m2, input.rainfall_depth_mm,
              input.impervious_runoff_coefficient, input.green_roof_fraction,
              input.green_roof_storage_mm, input.green_roof_runoff_coefficient]
    if not all(math.isfinite(v) for v in values):
        raise ValueError("URBAN_RUNOFF_NONFINITE")
    if input.roof_area_m2 < 0 or input.rainfall_depth_mm < 0 or input.green_roof_storage_mm < 0:
        raise ValueError("URBAN_RUNOFF_NEGATIVE_GEOMETRY_OR_RAINFALL")
    if not all(0 <= v <= 1 for v in (
        input.impervious_runoff_coefficient,
        input.green_roof_fraction,
        input.green_roof_runoff_coefficient,
    )):
        raise ValueError("URBAN_RUNOFF_INVALID_FRACTION")
    if not input.source_evidence_id.strip():
        raise ValueError("URBAN_RUNOFF_SOURCE_EVIDENCE_REQUIRED")
    # Rain depth in mm -> m. Separate treated/untreated fractions.
    baseline = input.roof_area_m2 * input.rainfall_depth_mm / 1000 * input.impervious_runoff_coefficient
    treated_area = input.roof_area_m2 * input.green_roof_fraction
    treated_excess_mm = max(0.0, input.rainfall_depth_mm - input.green_roof_storage_mm)
    treated_runoff = treated_area * treated_excess_mm / 1000 * input.green_roof_runoff_coefficient
    untreated_runoff = (input.roof_area_m2 - treated_area) * input.rainfall_depth_mm / 1000 * input.impervious_runoff_coefficient
    scenario = treated_runoff + untreated_runoff
    return {
        "schema": "tsm.urban-roof-screening.v1",
        "status": "ILLUSTRATIVE_UNCALIBRATED_SCREENING_ONLY",
        "source_evidence_id": input.source_evidence_id,
        "inputs": asdict(input),
        "baseline_roof_runoff_m3": baseline,
        "scenario_roof_runoff_m3": scenario,
        "difference_m3": baseline - scenario,
        "limitations": [
            "Only event-volume mass balance; no inflow hydrograph, infiltration kinetics, routing, groundwater, overflow or backwater.",
            "Storage and coefficients are user-declared, not remotely estimated or validated.",
            "Do not label outputs flood elevations, BFE, property risk or agency determination."
        ],
    }
