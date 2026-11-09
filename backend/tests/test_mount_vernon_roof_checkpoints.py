"""Synthetic checkpoint tests; no real survey data or field certification."""
from __future__ import annotations

import copy
import importlib.util
from pathlib import Path

import pytest

PATH = Path(__file__).resolve().parents[2] / "scripts/geospatial/validate_mount_vernon_roof_checkpoints.py"
spec = importlib.util.spec_from_file_location("tsm_roof_controls", PATH)
assert spec and spec.loader
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def samples():
    derived = {
        "schema": "tsm.mount-vernon-vertical-derivatives.v1",
        "engineering_approved": False,
        "units": "m",
        "source_scene_sha256": "a" * 64,
        "source_samples_sha256": "b" * 64,
        "roof_source_sha256": "c" * 64,
        "ground_dataset_sha256": "d" * 64,
        "records": [
            {"tsm_id": f"IGIO:building:{i}",
             "engineering_approved": False,
             "vertical_datum": "NAVD88",
             "roof_height_method": "CLASSIFIED_ROOF_POINT_MEDIAN",
             "roof_elevation_navd88_m": float(100 + i)}
            for i in (1, 2, 3)
        ],
    }
    control = {
        "schema": "tsm.mount-vernon-roof-checkpoints.v1",
        "vertical_datum": "NAVD88",
        "height_type": "ORTHOMETRIC",
        "measurement_target": "ROOF_REPRESENTATIVE_MEDIAN",
        "units": "m",
        "survey_source_sha256": "e" * 64,
        "survey_datum_metadata_sha256": "f" * 64,
        "checkpoints": [
            {"point_id": f"CP-{i}", "tsm_id": f"IGIO:building:{i}",
             "roof_elevation": float(100 + i) + 0.1}
            for i in (1, 2, 3)
        ],
    }
    return derived, control


def check(derived, control, **overrides):
    params = {"min_checkpoints": 3, "max_rmse_m": 0.2,
              "max_abs_error_m": 0.2, "min_coverage_fraction": 1.0}
    params.update(overrides)
    return m.evaluate(derived, control, **params)


def test_three_controls_pass_but_not_engineering_certified():
    derived, control = samples()
    result = check(derived, control)
    assert result["statistical_thresholds_met"] is True
    assert result["engineering_approved"] is False
    assert result["survey_certified"] is False
    assert result["source_provenance_authenticated"] is False
    assert result["metrics"]["rmse_m"] == pytest.approx(0.1)
    assert result["metrics"]["empirical_p95_absolute_error_m"] == pytest.approx(0.1)


def test_bad_control_residual_fails():
    derived, control = samples()
    control["checkpoints"][0]["roof_elevation"] += 3
    result = check(derived, control)
    assert result["statistical_thresholds_met"] is False
    assert result["metrics"]["max_absolute_error_m"] > 3


def test_missing_coverage_fails():
    derived, control = samples()
    control["checkpoints"].pop()
    result = check(derived, control)
    assert result["statistical_thresholds_met"] is False
    assert result["metrics"]["coverage_fraction"] == pytest.approx(2 / 3)


def test_ftus_control_conversion():
    derived, control = samples()
    control["units"] = "ftUS"
    for row in control["checkpoints"]:
        row["roof_elevation"] /= m.FTUS
    result = check(derived, control)
    assert result["metrics"]["rmse_m"] == pytest.approx(0.1)


@pytest.mark.parametrize("key,value,expected", [
    ("vertical_datum", "NGVD29", "CONTROL_DATUM"),
    ("height_type", "ELLIPSOIDAL", "CONTROL_DATUM"),
    ("measurement_target", "ROOF_RIDGE", "CONTROL_DATUM"),
    ("units", "ft", "CONTROL_UNITS"),
    ("survey_source_sha256", "c" * 64, "CONTROL_SOURCE_NOT_DISTINCT"),
    ("survey_source_sha256", None, "INVALID_SHA256"),
])
def test_reject_unreconciled_control_metadata(key, value, expected):
    derived, control = samples()
    control[key] = value
    with pytest.raises(ValueError, match=expected):
        check(derived, control)


def test_duplicate_checkpoints_rejected():
    derived, control = samples()
    control["checkpoints"].append(copy.deepcopy(control["checkpoints"][0]))
    with pytest.raises(ValueError, match="CONTROL_UNKNOWN_OR_DUPLICATE_ID"):
        check(derived, control)


def test_unsupported_derived_roof_method_rejected():
    derived, control = samples()
    derived["records"][0]["roof_height_method"] = "MANUALLY_SURVEYED_ROOF_HEIGHT"
    with pytest.raises(ValueError, match="DERIVED_ID_OR_METHOD_INVALID"):
        check(derived, control)


def test_nonfinite_and_boolean_values_rejected():
    derived, control = samples()
    derived["records"][0]["roof_elevation_navd88_m"] = float("nan")
    with pytest.raises(ValueError, match="NONFINITE"):
        check(derived, control)
    derived, control = samples()
    control["checkpoints"][0]["roof_elevation"] = True
    with pytest.raises(ValueError, match="INVALID_NUMBER"):
        check(derived, control)


def test_unreasonably_small_checkpoint_requirement_rejected():
    derived, control = samples()
    with pytest.raises(ValueError, match="MIN_CHECKPOINTS_TOO_SMALL"):
        check(derived, control, min_checkpoints=1)
