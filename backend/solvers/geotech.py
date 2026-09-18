"""Validated Bishop simplified-method geotechnical stability solver.

All inputs are explicit SI engineering quantities. The solver is deterministic,
fail-closed, and returns a SHA-256 identity for the normalized input payload.
It does not invent soil parameters or engineering conclusions.
"""
from __future__ import annotations

import hashlib
import json
import math
from typing import Any, Sequence

import numpy as np

METHOD_VERSION = "TSM-BISHOP-SIMPLIFIED-V35.1"
DEFAULT_FOS_THRESHOLD = 1.20


def _finite_array(name: str, values: Sequence[float]) -> np.ndarray:
    array = np.asarray(values, dtype=float)
    if array.ndim != 1 or array.size == 0:
        raise ValueError(f"{name} must be a non-empty one-dimensional sequence")
    if not np.all(np.isfinite(array)):
        raise ValueError(f"{name} contains non-finite values")
    return array


def _input_hash(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def calculate_bishop_factor_of_safety(
    cohesion_kpa: float,
    friction_angle_deg: float,
    slice_weights_kn: Sequence[float],
    slice_widths_m: Sequence[float],
    alpha_angles_deg: Sequence[float],
    pore_pressure_kpa: Sequence[float],
    max_iterations: int = 100,
    tolerance: float = 0.001,
    fos_threshold: float = DEFAULT_FOS_THRESHOLD,
) -> dict[str, Any]:
    """Compute Bishop's simplified-method factor of safety."""
    scalar_inputs = {
        "cohesion_kpa": cohesion_kpa,
        "friction_angle_deg": friction_angle_deg,
        "max_iterations": max_iterations,
        "tolerance": tolerance,
        "fos_threshold": fos_threshold,
    }
    if not all(math.isfinite(float(value)) for value in (cohesion_kpa, friction_angle_deg, tolerance, fos_threshold)):
        raise ValueError("scalar engineering inputs must be finite")
    if cohesion_kpa < 0:
        raise ValueError("cohesion_kpa must be >= 0")
    if not 0 <= friction_angle_deg < 90:
        raise ValueError("friction_angle_deg must satisfy 0 <= phi < 90 degrees")
    if max_iterations < 1:
        raise ValueError("max_iterations must be >= 1")
    if tolerance <= 0:
        raise ValueError("tolerance must be > 0")
    if fos_threshold <= 0:
        raise ValueError("fos_threshold must be > 0")

    weights = _finite_array("slice_weights_kn", slice_weights_kn)
    widths = _finite_array("slice_widths_m", slice_widths_m)
    alpha_deg = _finite_array("alpha_angles_deg", alpha_angles_deg)
    pore_pressure = _finite_array("pore_pressure_kpa", pore_pressure_kpa)
    if not (weights.size == widths.size == alpha_deg.size == pore_pressure.size):
        raise ValueError("all slice arrays must have identical lengths")
    if np.any(weights < 0):
        raise ValueError("slice_weights_kn must be >= 0")
    if np.any(widths <= 0):
        raise ValueError("slice_widths_m must be > 0")

    payload = {
        **scalar_inputs,
        "slice_weights_kn": weights.tolist(),
        "slice_widths_m": widths.tolist(),
        "alpha_angles_deg": alpha_deg.tolist(),
        "pore_pressure_kpa": pore_pressure.tolist(),
    }
    provenance_hash = _input_hash(payload)

    phi = math.radians(friction_angle_deg)
    alpha = np.radians(alpha_deg)
    driving = weights * np.sin(alpha)
    sum_driving = float(np.sum(driving))

    if sum_driving <= np.finfo(float).eps:
        return {
            "factor_of_safety": 999.0,
            "converged": True,
            "iterations": 0,
            "status": "NO_DRIVING_FORCE",
            "critical_threshold_violated": False,
            "method_version": METHOD_VERSION,
            "input_sha256": provenance_hash,
        }

    fos_current = 1.0
    converged = False
    status = "MAX_ITERATIONS"

    for iteration in range(1, max_iterations + 1):
        m_alpha = np.cos(alpha) + (np.sin(alpha) * math.tan(phi)) / fos_current
        if np.any(np.abs(m_alpha) <= 1e-12) or np.any(m_alpha < 0):
            raise ValueError("invalid Bishop m_alpha denominator for supplied geometry")

        effective_normal = weights - pore_pressure * widths
        resisting = (
            cohesion_kpa * widths
            + effective_normal * math.tan(phi)
        ) / m_alpha
        fos_new = float(np.sum(resisting) / sum_driving)
        if not math.isfinite(fos_new) or fos_new <= 0:
            raise ValueError("Bishop iteration produced a non-positive or non-finite factor of safety")

        if abs(fos_new - fos_current) < tolerance:
            fos_current = fos_new
            converged = True
            status = "CONVERGED"
            break
        fos_current = fos_new

    return {
        "factor_of_safety": round(fos_current, 4),
        "converged": converged,
        "iterations": iteration,
        "status": status,
        "critical_threshold_violated": fos_current < fos_threshold,
        "fos_threshold": fos_threshold,
        "method_version": METHOD_VERSION,
        "input_sha256": provenance_hash,
    }
