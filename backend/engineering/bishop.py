"""Deterministic simplified Bishop factor-of-safety calculation.

This is a computational primitive, not an engineering acceptance criterion.
Inputs and the adopted design standard must be reviewed by a qualified engineer.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import math


@dataclass(frozen=True)
class BishopSlice:
    width_ft: float
    weight_lb: float
    alpha_rad: float
    cohesion_psf: float
    friction_angle_rad: float
    pore_force_lb: float


@dataclass(frozen=True)
class BishopResult:
    factor_of_safety: float
    iterations: int
    converged: bool
    tolerance: float
    input_sha256: str
    method_version: str = "bishop-simplified-1.0"


def _canonical_input(slices: tuple[BishopSlice, ...], tolerance: float, max_iterations: int) -> bytes:
    payload = {
        "slices": [s.__dict__ for s in slices],
        "tolerance": tolerance,
        "max_iterations": max_iterations,
        "method_version": "bishop-simplified-1.0",
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()


def bishop_factor_of_safety(slices: tuple[BishopSlice, ...], *, tolerance: float = 1e-7, max_iterations: int = 200) -> BishopResult:
    if not slices or max_iterations < 1 or tolerance <= 0:
        raise ValueError("non-empty slices, positive tolerance, and max_iterations are required")
    if any(s.width_ft <= 0 or s.weight_lb < 0 or s.cohesion_psf < 0 or not all(math.isfinite(v) for v in (s.width_ft, s.weight_lb, s.alpha_rad, s.cohesion_psf, s.friction_angle_rad, s.pore_force_lb)) for s in slices):
        raise ValueError("slice inputs must be finite and physically bounded")
    previous = 1.0
    for iteration in range(1, max_iterations + 1):
        resisting = 0.0
        driving = 0.0
        for s in slices:
            ca = math.cos(s.alpha_rad)
            tan_phi = math.tan(s.friction_angle_rad)
            denominator = 1.0 + (tan_phi * math.tan(s.alpha_rad)) / previous
            effective_normal = max(0.0, s.weight_lb * ca - s.pore_force_lb) / denominator
            resisting += (s.cohesion_psf * s.width_ft + effective_normal * tan_phi) / max(ca, 1e-12)
            driving += s.weight_lb * math.sin(s.alpha_rad)
        if driving <= 0:
            raise ValueError("Bishop driving force must be positive")
        current = resisting / driving
        if abs(current - previous) <= tolerance:
            digest = hashlib.sha256(_canonical_input(slices, tolerance, max_iterations)).hexdigest()
            return BishopResult(current, iteration, True, tolerance, digest)
        previous = current
    digest = hashlib.sha256(_canonical_input(slices, tolerance, max_iterations)).hexdigest()
    return BishopResult(previous, max_iterations, False, tolerance, digest)
