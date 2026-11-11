#!/usr/bin/env python3
"""
TSM ECEF regression fixtures — Bonebank mathematical precision, orthonormality, bounds.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SYS_GEO = ROOT / "scripts" / "geospatial"
if str(SYS_GEO) not in sys.path:
    sys.path.insert(0, str(SYS_GEO))

from tsm_ecef_validator import (  # noqa: E402
    POSEY_CO_ECEF_BOUNDS,
    validate_ecef_translation,
    validate_rotation_orthonormality,
    ECEFValidationError,
)

# Locked fixture (h = 120 m, φ = 37.84589°, λ = −88.00510°)
BONEBANK_ECEF = (175550.84, -5039980.67, 3892024.17)
WGS84_A = 6378137.0
WGS84_F = 1 / 298.257223563
WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F


def wgs84_ecef(lat_deg: float, lon_deg: float, h: float) -> tuple[float, float, float]:
    phi = math.radians(lat_deg)
    lam = math.radians(lon_deg)
    s, c = math.sin(phi), math.cos(phi)
    n = WGS84_A / math.sqrt(1.0 - WGS84_E2 * s * s)
    x = (n + h) * c * math.cos(lam)
    y = (n + h) * c * math.sin(lam)
    z = (n * (1.0 - WGS84_E2) + h) * s
    return x, y, z


def test_bonebank_geodetic_mathematical_precision() -> None:
    x, y, z = wgs84_ecef(37.84589, -88.00510, 120.0)
    fx, fy, fz = BONEBANK_ECEF
    assert abs(x - fx) < 0.05
    assert abs(y - fy) < 0.05
    assert abs(z - fz) < 0.05
    assert x > 0, "Midwest sign trap: X must be positive near 88W"


def test_transform_matrix_orthonormality() -> None:
    m = [
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        BONEBANK_ECEF[0], BONEBANK_ECEF[1], BONEBANK_ECEF[2], 1.0,
    ]
    assert validate_rotation_orthonormality(m) is True

    # Det ≈ −1 (reflection) must fail
    reflected = [
        -1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        BONEBANK_ECEF[0], BONEBANK_ECEF[1], BONEBANK_ECEF[2], 1.0,
    ]
    with pytest.raises(ECEFValidationError):
        validate_rotation_orthonormality(reflected)


def test_bounds_enforcement() -> None:
    m_ok = [
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        BONEBANK_ECEF[0], BONEBANK_ECEF[1], BONEBANK_ECEF[2], 1.0,
    ]
    validate_ecef_translation(m_ok)

    m_neg_x = m_ok.copy()
    m_neg_x[12] = -abs(BONEBANK_ECEF[0])
    with pytest.raises(ECEFValidationError):
        validate_ecef_translation(m_neg_x)

    m_origin = m_ok.copy()
    m_origin[12] = m_origin[13] = m_origin[14] = 0.0
    with pytest.raises(ECEFValidationError):
        validate_ecef_translation(m_origin)

    b = POSEY_CO_ECEF_BOUNDS
    assert b["x_min"] > 0
