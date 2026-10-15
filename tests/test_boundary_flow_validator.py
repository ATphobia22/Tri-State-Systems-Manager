from datetime import datetime, timedelta, timezone

from tsm_runtime.boundary_flow_validator import validate_boundary_csv


def write_csv(tmp_path, rows):
    path = tmp_path / "boundary.csv"
    path.write_text(
        "timestamp,flow_cfs,froude_number\n" + "\n".join(rows) + "\n",
        encoding="utf-8",
    )
    return path


def telemetry(now, gauge="03378500"):
    return {"verified": True, "gauge_id": gauge, "observed_at": now.isoformat()}


def test_valid_series_only_passes_for_review(tmp_path):
    now = datetime(2026, 10, 15, 12, 0, tzinfo=timezone.utc)
    path = write_csv(tmp_path, [
        "2026-10-15T11:30:00Z,1000,0.40",
        "2026-10-15T11:45:00Z,1100,0.45",
        "2026-10-15T12:00:00Z,1200,0.50",
    ])
    result = validate_boundary_csv(
        path, boundary="WABASH_COMPONENT_03378500", gauge_id="03378500",
        normal_depth_slope_ft_ft=0.0004,
        telemetry_evidence=telemetry(now), now=now,
    )
    assert result.valid
    assert result.as_dict()["execution_allowed"] is False


def test_wrong_gauge_locks_pipeline(tmp_path):
    now = datetime(2026, 10, 15, 12, 0, tzinfo=timezone.utc)
    path = write_csv(tmp_path, [
        "2026-10-15T11:45:00Z,1000,0.4",
        "2026-10-15T12:00:00Z,1100,0.4",
    ])
    result = validate_boundary_csv(
        path, boundary="WABASH_COMPONENT_03378500", gauge_id="03322000",
        normal_depth_slope_ft_ft=0.0004,
        telemetry_evidence=telemetry(now, "03322000"), now=now,
    )
    assert result.status == "PIPELINE_LOCKED"
    assert any("requires configured gauge" in error for error in result.errors)


def test_missing_timestamp_counts_as_gap(tmp_path):
    now = datetime(2026, 10, 15, 12, 0, tzinfo=timezone.utc)
    path = write_csv(tmp_path, [
        "2026-10-15T11:15:00Z,1000,0.4",
        "2026-10-15T12:00:00Z,1100,0.4",
    ])
    result = validate_boundary_csv(
        path, boundary="WABASH_COMPONENT_03378500", gauge_id="03378500",
        normal_depth_slope_ft_ft=0.0004,
        telemetry_evidence=telemetry(now), now=now,
    )
    assert result.status == "PIPELINE_LOCKED"
    assert result.missing_records == 2


def test_froude_and_slope_thresholds_lock_pipeline(tmp_path):
    now = datetime(2026, 10, 15, 12, 0, tzinfo=timezone.utc)
    path = write_csv(tmp_path, [
        "2026-10-15T11:45:00Z,1000,0.85",
        "2026-10-15T12:00:00Z,1100,0.90",
    ])
    result = validate_boundary_csv(
        path, boundary="WABASH_COMPONENT_03378500", gauge_id="03378500",
        normal_depth_slope_ft_ft=0.001,
        telemetry_evidence=telemetry(now), now=now,
    )
    assert result.status == "PIPELINE_LOCKED"
    assert any("slope must be within" in error for error in result.errors)
    assert any("Froude" in error for error in result.errors)


def test_stale_telemetry_locks_pipeline(tmp_path):
    now = datetime(2026, 10, 15, 12, 0, tzinfo=timezone.utc)
    path = write_csv(tmp_path, [
        "2026-10-15T11:45:00Z,1000,0.4",
        "2026-10-15T12:00:00Z,1100,0.4",
    ])
    evidence = telemetry(now - timedelta(hours=2))
    result = validate_boundary_csv(
        path, boundary="WABASH_COMPONENT_03378500", gauge_id="03378500",
        normal_depth_slope_ft_ft=0.0004,
        telemetry_evidence=evidence, now=now,
    )
    assert result.status == "PIPELINE_LOCKED"
    assert any("stale" in error for error in result.errors)
