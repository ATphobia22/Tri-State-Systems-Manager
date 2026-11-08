"""Tests for backend/survey/cogo.py — thin COGO wrappers.

Run from the repo root:  python3 -m pytest backend/tests/test_survey_cogo.py -v

Regression values come from pySurveying's own upstream tests
(closed 100-ft square traverse; angle adjustment) so a wrapper bug
shows up as a mismatch against the library, not against our own math.
"""

from __future__ import annotations

import math

import pytest

from backend.survey.cogo import (
    adjust_angles,
    azimuth_between,
    closed_traverse,
    closed_traverse_from_angles,
    connected_traverse,
    distance_between,
    distance_intersection,
    forward,
    forward_intersection,
    inverse,
    polar_stakeout,
    resection,
)


def test_inverse_and_forward_round_trip():
    result = inverse((2000.0, 1000.0), (2100.0, 1100.0))
    assert result["provisional"] is True
    assert math.isclose(result["distance"], math.hypot(100.0, 100.0), rel_tol=1e-12)
    assert math.isclose(result["azimuth_deg"], 45.0, abs_tol=1e-12)
    back = forward(
        (2000.0, 1000.0), result["azimuth_deg"], result["distance"]
    )
    assert math.isclose(back["point"][0], 2100.0, abs_tol=1e-9)
    assert math.isclose(back["point"][1], 1100.0, abs_tol=1e-9)


def test_inverse_cardinal_azimuths():
    assert math.isclose(azimuth_between((0.0, 0.0), (100.0, 0.0)), 90.0)
    assert math.isclose(azimuth_between((0.0, 0.0), (0.0, 100.0)), 0.0)
    assert math.isclose(azimuth_between((0.0, 0.0), (-100.0, 0.0)), 270.0)
    assert math.isclose(distance_between((0.0, 0.0), (3.0, 4.0)), 5.0)


def test_closed_square_traverse_closes():
    # pySurveying upstream regression: 100-ft square, zero misclosure.
    result = closed_traverse((0.0, 0.0), [90, 0, 270, 180], [100, 100, 100, 100])
    assert math.isclose(result["linear_misclosure"], 0.0, abs_tol=1e-10)
    assert math.isclose(result["coordinates"][-1][0], 0.0, abs_tol=1e-10)
    assert math.isclose(result["coordinates"][-1][1], 0.0, abs_tol=1e-10)
    # Floating-point closure is ~1e-14 ft, not exact zero, so the
    # relative precision is finite but enormous (not 1:inf).
    assert result["relative_precision"] is not None
    assert result["relative_precision"] > 1e12
    assert result["provisional"] is True


def test_connected_traverse_hits_endpoint():
    result = connected_traverse((0.0, 0.0), (100.0, 100.0), [90, 0], [100, 100])
    x, y = result["coordinates"][-1]
    assert math.isclose(x, 100.0, abs_tol=1e-10)
    assert math.isclose(y, 100.0, abs_tol=1e-10)


def test_closed_traverse_from_angles():
    result = closed_traverse_from_angles(
        (0.0, 0.0), 90.0, [90.0, 90.0, 90.0, 90.0],
        [100.0, 100.0, 100.0, 100.0], turn="right",
    )
    assert math.isclose(result["linear_misclosure"], 0.0, abs_tol=1e-10)
    assert math.isclose(result["direction_misclosure_deg"], 0.0, abs_tol=1e-10)


def test_adjust_angles_closes_polygon():
    result = adjust_angles([90.01, 89.99, 90.02, 90.00])
    assert math.isclose(sum(result["adjusted_angles_deg"]), 360.0, abs_tol=1e-12)
    assert math.isclose(sum(result["corrections_deg"]), -0.02, abs_tol=1e-12)


def test_forward_intersection_and_distance_intersection():
    point = forward_intersection((0.0, 0.0), 45.0, (100.0, 0.0), 315.0)
    assert math.isclose(point["point"][0], 50.0, abs_tol=1e-9)
    assert math.isclose(point["point"][1], 50.0, abs_tol=1e-9)
    both = distance_intersection((0.0, 0.0), 5.0, (6.0, 0.0), 5.0)
    assert both["solution_count"] == 2
    assert any(
        math.isclose(x, 3.0, abs_tol=1e-9) and math.isclose(y, 4.0, abs_tol=1e-9)
        for x, y in both["solutions"]
    )


def test_parallel_intersection_raises():
    with pytest.raises(ValueError, match="parallel"):
        forward_intersection((0.0, 0.0), 90.0, (0.0, 100.0), 90.0)


def test_resection_recovers_station():
    # Three known points around the origin; directions computed from the
    # true station (50, 50) with zero orientation offset.
    known = [(0.0, 0.0), (100.0, 0.0), (0.0, 100.0)]
    directions = [azimuth_between((50.0, 50.0), p) for p in known]
    result = resection(known, directions)
    assert math.isclose(result["station"][0], 50.0, abs_tol=1e-6)
    assert math.isclose(result["station"][1], 50.0, abs_tol=1e-6)


def test_polar_stakeout():
    result = polar_stakeout((0.0, 0.0), (100.0, 100.0))
    assert math.isclose(result["azimuth_deg"], 45.0, abs_tol=1e-12)
    assert math.isclose(result["distance"], math.hypot(100.0, 100.0), rel_tol=1e-12)


def test_non_finite_input_rejected():
    with pytest.raises(ValueError):
        inverse((float("nan"), 0.0), (1.0, 1.0))
    with pytest.raises(ValueError):
        forward((0.0, 0.0), 90.0, -5.0)


def test_posey_style_traverse_synthetic_fixture():
    """Synthetic Posey-style fixture: rounded whole-foot EPSG:2966
    coordinates in the county's State Plane range. SYNTHETIC — not a
    survey, not a real parcel, no real-world point is claimed."""
    start = (2686500.0, 947400.0)
    result = closed_traverse(
        start, [90, 0, 270, 180], [200, 200, 200, 200], units="US ft"
    )
    assert result["crs"] == "EPSG:2966"
    assert math.isclose(result["linear_misclosure"], 0.0, abs_tol=1e-9)
    assert math.isclose(result["coordinates"][-1][0], start[0], abs_tol=1e-9)
    assert math.isclose(result["coordinates"][-1][1], start[1], abs_tol=1e-9)
