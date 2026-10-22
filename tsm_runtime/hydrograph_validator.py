"""Resilient validation for hydrologic boundary time series.

This module validates supplied samples; it does not assert that a USGS gauge is
representative of a model boundary or that a gauge is currently transmitting.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import math
from typing import Iterable, Sequence


@dataclass(frozen=True)
class HydrographValidation:
    valid: bool
    blocked: bool
    errors: tuple[str, ...]
    missing_steps: int
    missing_fraction: float


def validate_hydrograph(
    timestamps: Sequence[datetime],
    values: Sequence[float | None],
    *,
    expected_interval_seconds: int,
    max_consecutive_missing: int = 2,
    max_missing_fraction: float = 0.01,
) -> HydrographValidation:
    errors: list[str] = []
    if expected_interval_seconds <= 0:
        errors.append("expected_interval_seconds must be positive")
    if len(timestamps) != len(values) or len(timestamps) < 2:
        errors.append("timestamps and values must have equal length >= 2")
        return HydrographValidation(False, True, tuple(errors), 0, 0.0)

    if any(tz is None or tz.utcoffset() is None for tz in timestamps):
        errors.append("all timestamps must be timezone-aware")
    if any(timestamps[i] >= timestamps[i + 1] for i in range(len(timestamps) - 1)):
        errors.append("timestamps must be strictly increasing")

    if not errors:
        for left, right in zip(timestamps, timestamps[1:]):
            delta = (right - left).total_seconds()
            if not math.isclose(delta, expected_interval_seconds, abs_tol=1e-6):
                errors.append("timestamp intervals do not match configured interval")
                break

    missing = 0
    max_run = 0
    run = 0
    for value in values:
        if value is None:
            missing += 1
            run += 1
            max_run = max(max_run, run)
        elif not math.isfinite(value):
            errors.append("values must be finite or explicitly missing")
            run = 0
        else:
            run = 0

    fraction = missing / len(values)
    if max_run > max_consecutive_missing:
        errors.append("consecutive missing-step threshold exceeded")
    if fraction > max_missing_fraction:
        errors.append("total missing-data fraction threshold exceeded")

    return HydrographValidation(
        valid=not errors,
        blocked=bool(errors),
        errors=tuple(dict.fromkeys(errors)),
        missing_steps=missing,
        missing_fraction=fraction,
    )


def validate_boundary_physics(
    *,
    slope_ft_per_ft: float | None,
    froude_numbers: Iterable[float],
    minimum_slope: float = 0.0001,
    maximum_slope: float = 0.0008,
    maximum_subcritical_froude: float = 0.85,
) -> tuple[bool, tuple[str, ...]]:
    """Validate configured screening limits; limits require project-specific review."""
    errors: list[str] = []
    if slope_ft_per_ft is None or not math.isfinite(slope_ft_per_ft):
        errors.append("a finite, source-supported energy slope is required")
    elif not minimum_slope <= slope_ft_per_ft <= maximum_slope:
        errors.append("energy slope is outside configured screening bounds")

    fr_values = list(froude_numbers)
    if not fr_values:
        errors.append("boundary Froude evidence is missing")
    elif any(not math.isfinite(fr) or fr < 0 for fr in fr_values):
        errors.append("Froude values must be finite and non-negative")
    elif any(fr >= maximum_subcritical_froude for fr in fr_values):
        errors.append("boundary Froude screening limit exceeded")

    return not errors, tuple(errors)
