#!/usr/bin/env python3
"""Semantic test suite for PointTube temporal data structure.

Verifies the strict state semantics from docs/TSM-POINTTUBE-CONTRACT.md:
- Categorical state is NEVER interpolated
- Numeric positions interpolate ONLY between OBSERVED/DERIVED anchors
- Out-of-range timestamps raise TemporalRangeError (no silent extrapolation)
- Every sample carries provenance (source, confidence, validity interval)
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts" / "geospatial"))

from point_tube import (
    PointTube,
    StateType,
    TemporalRangeError,
    TubeSample,
)


def make_sample(timestamp, coords=(1.0, 2.0, 3.0), state=StateType.OBSERVED,
                source="test-source", confidence="HIGH",
                valid_from=None, valid_to=None, interpolation="none"):
    return TubeSample(
        timestamp=timestamp,
        coords=coords,
        state=state,
        source=source,
        confidence=confidence,
        valid_from=valid_from if valid_from is not None else timestamp - 0.5,
        valid_to=valid_to if valid_to is not None else timestamp + 0.5,
        interpolation=interpolation,
    )


def make_tube():
    """Tube with two OBSERVED anchors at t=2020.0 and t=2022.0."""
    tube = PointTube("test-tube")
    tube.add(make_sample(2020.0, coords=(0.0, 0.0, 100.0)))
    tube.add(make_sample(2022.0, coords=(10.0, 20.0, 110.0)))
    return tube


# --- Categorical non-interpolation ---

def test_get_state_at_returns_exact_state():
    tube = make_tube()
    assert tube.get_state_at(2020.0) == StateType.OBSERVED
    assert tube.get_state_at(2022.0) == StateType.OBSERVED


def test_get_state_at_never_blends_states():
    """Categorical state is never interpolated between samples."""
    tube = PointTube("mixed")
    tube.add(make_sample(2020.0, state=StateType.OBSERVED,
                         valid_from=2019.5, valid_to=2020.5))
    tube.add(make_sample(2021.0, state=StateType.EVENT,
                         valid_from=2020.5, valid_to=2021.5))
    # At t=2020.7, only the EVENT sample's interval covers it
    assert tube.get_state_at(2020.7) == StateType.EVENT
    # At t=2020.2, only the OBSERVED sample covers it
    assert tube.get_state_at(2020.2) == StateType.OBSERVED


def test_get_state_at_raises_when_no_coverage():
    tube = make_tube()
    with pytest.raises(TemporalRangeError):
        tube.get_state_at(2025.0)


def test_get_state_at_raises_on_ambiguous_overlap():
    tube = PointTube("ambiguous")
    tube.add(make_sample(2020.0, state=StateType.OBSERVED,
                         valid_from=2019.5, valid_to=2021.5))
    tube.add(make_sample(2021.0, state=StateType.DERIVED,
                         valid_from=2020.5, valid_to=2021.5))
    with pytest.raises(TemporalRangeError):
        tube.get_state_at(2021.0)


# --- Allowed numeric interpolation ---

def test_get_position_at_exact_anchor():
    tube = make_tube()
    s = tube.get_position_at(2020.0)
    assert s.coords == (0.0, 0.0, 100.0)
    assert s.state == StateType.OBSERVED


def test_get_position_at_interpolates_linearly():
    tube = make_tube()
    s = tube.get_position_at(2021.0)
    assert s.state == StateType.INTERPOLATED
    assert s.interpolation == "linear"
    assert s.coords == pytest.approx((5.0, 10.0, 105.0))


def test_interpolated_sample_labeled():
    tube = make_tube()
    s = tube.get_position_at(2021.5)
    assert s.state == StateType.INTERPOLATED
    assert "interpolated" in s.source
    assert s.confidence == "INTERPOLATED"


def test_derived_anchors_participate():
    tube = PointTube("derived")
    tube.add(make_sample(2020.0, state=StateType.DERIVED, coords=(0.0, 0.0, 0.0)))
    tube.add(make_sample(2022.0, state=StateType.OBSERVED, coords=(4.0, 0.0, 0.0)))
    s = tube.get_position_at(2021.0)
    assert s.coords == pytest.approx((2.0, 0.0, 0.0))


# --- No extrapolation ---

def test_get_position_at_raises_before_first_anchor():
    tube = make_tube()
    with pytest.raises(TemporalRangeError):
        tube.get_position_at(2019.0)


def test_get_position_at_raises_after_last_anchor():
    tube = make_tube()
    with pytest.raises(TemporalRangeError):
        tube.get_position_at(2023.0)


def test_get_position_at_raises_with_no_anchors():
    tube = PointTube("empty")
    tube.add(make_sample(2020.0, state=StateType.SIMULATED))
    with pytest.raises(TemporalRangeError):
        tube.get_position_at(2020.0)


def test_simulated_does_not_anchor_interpolation():
    """SIMULATED states are isolated; they never become interpolation anchors."""
    tube = PointTube("sim")
    tube.add(make_sample(2020.0, state=StateType.OBSERVED, coords=(0.0, 0.0, 0.0)))
    tube.add(make_sample(2021.0, state=StateType.SIMULATED, coords=(100.0, 100.0, 100.0)))
    # Only one anchor; interpolation range is degenerate
    with pytest.raises(TemporalRangeError):
        tube.get_position_at(2020.5)


# --- Validity intervals ---

def test_sample_rejects_timestamp_outside_validity():
    tube = PointTube("v")
    with pytest.raises(ValueError, match="timestamp outside validity interval"):
        tube.add(make_sample(2020.0, valid_from=2021.0, valid_to=2022.0))


def test_sample_rejects_inverted_validity():
    tube = PointTube("v")
    with pytest.raises(ValueError, match="valid_from > valid_to"):
        tube.add(make_sample(2020.0, valid_from=2021.0, valid_to=2020.0))


# --- Provenance ---

def test_sample_requires_source():
    tube = PointTube("v")
    with pytest.raises(ValueError, match="provenance"):
        tube.add(make_sample(2020.0, source="  "))


def test_sample_requires_confidence():
    tube = PointTube("v")
    with pytest.raises(ValueError, match="provenance"):
        tube.add(make_sample(2020.0, confidence=""))


def test_sample_requires_finite_coords():
    tube = PointTube("v")
    with pytest.raises(ValueError, match="finite"):
        tube.add(make_sample(2020.0, coords=(1.0, float("inf"), 3.0)))


def test_interpolated_must_declare_linear():
    tube = PointTube("v")
    with pytest.raises(ValueError, match="INTERPOLATED"):
        tube.add(make_sample(2020.0, state=StateType.INTERPOLATED, interpolation="none"))


def test_non_interpolated_cannot_declare_interpolation():
    tube = PointTube("v")
    with pytest.raises(ValueError, match="cannot declare interpolation"):
        tube.add(make_sample(2020.0, state=StateType.OBSERVED, interpolation="linear"))


def test_duplicate_anchor_timestamp_rejected():
    tube = PointTube("dup")
    tube.add(make_sample(2020.0))
    with pytest.raises(ValueError, match="duplicate"):
        tube.add(make_sample(2020.0))


# --- Serialization ---

def test_to_dict_from_dict_roundtrip():
    tube = make_tube()
    d = tube.to_dict()
    tube2 = PointTube.from_dict(d)
    assert tube2.tube_id == tube.tube_id
    assert tube2.crs == tube.crs
    assert tube2.vertical_datum == tube.vertical_datum
    assert len(tube2._samples) == 2
    s = tube2.get_position_at(2021.0)
    assert s.coords == pytest.approx((5.0, 10.0, 105.0))


def test_from_dict_preserves_states():
    tube = make_tube()
    tube2 = PointTube.from_dict(tube.to_dict())
    assert tube2.get_state_at(2020.0) == StateType.OBSERVED
