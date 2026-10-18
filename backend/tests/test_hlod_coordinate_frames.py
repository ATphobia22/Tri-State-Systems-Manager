"""Numerical regression tests for the HLOD builder's local ENU frame.

These tests exercise coordinate-frame math only; they do not certify source CRS,
vertical datum, survey accuracy, or engineering suitability of any dataset.
"""
from __future__ import annotations

import importlib.util
import math
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
BUILDER_PATH = REPO_ROOT / "scripts" / "geospatial" / "build-hlod-tileset.py"
SPEC = importlib.util.spec_from_file_location("build_hlod_tileset", BUILDER_PATH)
assert SPEC is not None and SPEC.loader is not None
BUILDER = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = BUILDER
SPEC.loader.exec_module(BUILDER)

V = BUILDER.V


def close_vector(actual, expected, *, abs_tol: float = 1e-8) -> None:
    assert actual.x == pytest.approx(expected.x, abs=abs_tol)
    assert actual.y == pytest.approx(expected.y, abs=abs_tol)
    assert actual.z == pytest.approx(expected.z, abs=abs_tol)


def test_enu_axes_are_orthonormal_at_equatorial_ecef_origin() -> None:
    origin = V(6_378_137.0, 0.0, 0.0)
    east, north, up = BUILDER.axes(origin)

    def dot(a, b):
        return BUILDER.dot(a, b)

    for axis in (east, north, up):
        assert dot(axis, axis) == pytest.approx(1.0, abs=1e-12)
    assert dot(east, north) == pytest.approx(0.0, abs=1e-12)
    assert dot(east, up) == pytest.approx(0.0, abs=1e-12)
    assert dot(north, up) == pytest.approx(0.0, abs=1e-12)


def test_local_origin_projects_to_zero_and_east_offset_is_metric() -> None:
    origin = V(6_378_137.0, 0.0, 0.0)
    axes = BUILDER.axes(origin)

    close_vector(BUILDER.project(origin, origin, axes), V(0.0, 0.0, 0.0))

    east, _, _ = axes
    point_ten_metres_east = V(
        origin.x + 10.0 * east.x,
        origin.y + 10.0 * east.y,
        origin.z + 10.0 * east.z,
    )
    close_vector(
        BUILDER.project(point_ten_metres_east, origin, axes),
        V(10.0, 0.0, 0.0),
        abs_tol=1e-7,
    )


def test_local_frame_transform_and_inverse_round_trip() -> None:
    origin = V(6_378_000.0, 250_000.0, 1_100_000.0)
    frame = BUILDER.matrix(origin, BUILDER.axes(origin))
    inverse = BUILDER.inv(frame)

    for local in (
        V(0.0, 0.0, 0.0),
        V(12.5, -4.0, 1.25),
        V(-2_000.0, 3_000.0, 55.0),
    ):
        world = BUILDER.pt(frame, local)
        restored = BUILDER.pt(inverse, world)
        close_vector(restored, local, abs_tol=1e-7)


def test_frame_matrix_composed_with_inverse_is_identity() -> None:
    origin = V(6_378_000.0, 250_000.0, 1_100_000.0)
    frame = BUILDER.matrix(origin, BUILDER.axes(origin))
    product = BUILDER.mm(BUILDER.inv(frame), frame)
    expected = [1.0, 0.0, 0.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0]
    assert product == pytest.approx(expected, abs=1e-7)


def test_axis_calculation_rejects_no_finite_values_by_contract() -> None:
    # Guard this test against accidental NaN propagation in the vector math.
    # Input validation belongs at the source/manifest boundary; this test
    # asserts the current helper output is finite for a valid ECEF point.
    origin = V(6_378_137.0, 0.0, 0.0)
    for axis in BUILDER.axes(origin):
        assert all(math.isfinite(value) for value in (axis.x, axis.y, axis.z))
