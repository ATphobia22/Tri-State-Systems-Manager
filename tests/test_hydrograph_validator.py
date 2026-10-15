from datetime import datetime, timedelta, timezone

from tsm_runtime.hydrograph_validator import (
    validate_boundary_physics,
    validate_hydrograph,
)


def samples(values):
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    times = [start + timedelta(minutes=15 * i) for i in range(len(values))]
    return times, values


def test_valid_regular_series_passes():
    times, values = samples([1.0, 2.0, 3.0, 4.0])
    result = validate_hydrograph(times, values, expected_interval_seconds=900)
    assert result.valid and not result.blocked


def test_missing_run_over_limit_blocks():
    times, values = samples([1.0, None, None, None, 2.0])
    result = validate_hydrograph(times, values, expected_interval_seconds=900)
    assert result.blocked
    assert "consecutive missing-step threshold exceeded" in result.errors


def test_interval_mismatch_blocks():
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    times = [start, start + timedelta(minutes=15), start + timedelta(minutes=45)]
    result = validate_hydrograph(times, [1.0, 2.0, 3.0], expected_interval_seconds=900)
    assert result.blocked


def test_nonfinite_value_blocks():
    times, values = samples([1.0, float("nan"), 3.0])
    assert validate_hydrograph(times, values, expected_interval_seconds=900).blocked


def test_physics_screening_rejects_froude_threshold():
    valid, errors = validate_boundary_physics(
        slope_ft_per_ft=0.0003, froude_numbers=[0.4, 0.9]
    )
    assert not valid
    assert errors


def test_missing_physics_evidence_blocks():
    valid, errors = validate_boundary_physics(
        slope_ft_per_ft=None, froude_numbers=[]
    )
    assert not valid
    assert len(errors) == 2
