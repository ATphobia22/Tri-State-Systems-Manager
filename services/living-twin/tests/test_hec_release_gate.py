"""Evidence-first HEC/USGS comparison using synthetic data only; never solver certification."""
from copy import deepcopy
import hashlib
from uuid import uuid4

import pytest

from test_hydrology_validation import datum, events
from twin.hec_release_gate import assess, SCHEMA


def model_evidence(tmp_path):
    sources = {}
    for kind, suffix in (("geometry", ".g01"), ("plan", ".p01"), ("flow", ".u01"),
                         ("terrain", ".tif"), ("result_hdf", ".p01.hdf")):
        filename = kind + suffix
        data = ("SYNTHETIC_ONLY_" + kind).encode()
        (tmp_path / filename).write_bytes(data)
        sources[kind] = {"path": filename, "sha256": hashlib.sha256(data).hexdigest()}
    manifest = {
        "schema": SCHEMA, "model_engine": "HEC-RAS", "solver_version": "test-6.6",
        "model_revision_sha256": "f" * 64,
        "horizontal_crs": "EPSG:2966", "vertical_datum": "NAVD88", "vertical_units": "ft",
        "aoi_approval": {"status": "APPROVED", "watershed_delineation_sha256": "d" * 64,
                         "approval_evidence_uri": "https://example.org/approved-test-aoi"},
        "hdf_extraction_reviewed": True,
        "hdf_extraction_evidence_uri": "https://example.org/test-metadata-check",
        "max_time_skew_seconds": 60, "artifacts": sources,
    }
    return manifest


def pairs(manifest):
    items = []
    for index, value in enumerate((8.0, 9.0, 10.0)):
        obs, model = events()
        obs["event_id"], model["event_id"] = str(uuid4()), str(uuid4())
        time = f"2025-01-01T12:0{index}:00Z"
        obs["valid_from"], model["valid_from"] = time, time
        obs["state"]["value"] = value
        model["state"]["stage_ft"] = 300.0 + value + 0.2
        model["state"]["model_revision_sha256"] = manifest["model_revision_sha256"]
        model["source"] = {
            "authority": "HEC-RAS", "uri": "https://example.org/synthetic-model",
            "retrieved_at": "2025-01-02T00:00:00Z",
            "sha256": manifest["artifacts"]["result_hdf"]["sha256"],
        }
        items.append({"observation": obs, "prediction": model,
                      "partition": "calibration" if index == 0 else "holdout"})
    return items


def test_hashed_model_and_distinct_holdout_only_produce_preliminary_report(tmp_path):
    manifest = model_evidence(tmp_path)
    data = pairs(manifest)
    report = assess(manifest, data, tmp_path, gage_zero_by_station={
        "USGS-03378500": datum()})
    assert report["status"] == "PRELIMINARY_COMPARISON_FOR_HUMAN_REVIEW"
    assert report["blockers"] == []
    assert report["regulatoryDetermination"] is False
    assert report["engineeringCertification"] is False
    assert report["publicPublication"].startswith("BLOCKED")
    assert report["metrics"]["calibration"]["sample_count"] == 1
    assert report["metrics"]["holdout"]["sample_count"] == 2
    assert report["metrics"]["holdout"]["rmse_ft"] == pytest.approx(0.2)
    assert report["metrics"]["holdout"]["bias_ft"] == pytest.approx(0.2)
    assert report["metrics"]["holdout"]["nse"] == pytest.approx(0.96)
    assert assess(manifest, data, tmp_path, gage_zero_by_station={
        "USGS-03378500": datum()}) == report


def test_unapproved_aoi_and_missing_datum_suppress_publication(tmp_path):
    manifest = model_evidence(tmp_path)
    manifest["aoi_approval"]["status"] = "NOT_APPROVED"
    report = assess(manifest, pairs(manifest), tmp_path)
    assert report["status"] == "WITHHELD_EVIDENCE"
    assert "AOI_AND_WATERSHED_NOT_APPROVED" in report["blockers"]
    assert any("GAGE_ZERO_UNREVIEWED" in item for item in report["blockers"])
    assert report["metrics"]["holdout"]["sample_count"] == 0


def test_hdf_tamper_blocks_release_even_if_samples_pair(tmp_path):
    manifest = model_evidence(tmp_path)
    (tmp_path / manifest["artifacts"]["result_hdf"]["path"]).write_bytes(b"changed")
    report = assess(manifest, pairs(manifest), tmp_path, gage_zero_by_station={
        "USGS-03378500": datum()})
    assert "result_hdf:ARTIFACT_SHA256_MISMATCH" in report["blockers"]
    assert any("MODEL_OR_USGS_SOURCE_LINEAGE_MISMATCH" in b for b in report["blockers"])


def test_reused_observation_cannot_cross_calibration_holdout(tmp_path):
    manifest = model_evidence(tmp_path)
    data = pairs(manifest)
    data[1]["observation"] = deepcopy(data[0]["observation"])
    report = assess(manifest, data, tmp_path, gage_zero_by_station={
        "USGS-03378500": datum()})
    assert any("DUPLICATE_OR_LEAKED_CALIBRATION_OBSERVATION" in b for b in report["blockers"])


def test_provisional_holdout_and_missing_uncertainty_withhold(tmp_path):
    manifest = model_evidence(tmp_path)
    data = pairs(manifest)
    data[1]["observation"]["state"]["quality"] = "Provisional"
    data[2]["prediction"]["state"]["uncertainty_ft"] = None
    report = assess(manifest, data, tmp_path, gage_zero_by_station={
        "USGS-03378500": datum()})
    assert any("HOLDOUT_OBSERVATION_NOT_APPROVED" in b for b in report["blockers"])
    assert any("UNCERTAINTY_BUDGET_INCOMPLETE" in b for b in report["blockers"])


def test_reject_symlink_and_path_traversal_and_incorrect_revision(tmp_path):
    manifest = model_evidence(tmp_path)
    data = pairs(manifest)
    manifest["artifacts"]["geometry"]["path"] = "../outside.g01"
    data[0]["prediction"]["state"]["model_revision_sha256"] = "e" * 64
    report = assess(manifest, data, tmp_path, gage_zero_by_station={
        "USGS-03378500": datum()})
    assert "geometry:ARTIFACT_PATH_UNSAFE" in report["blockers"]
    assert any("MODEL_OR_USGS_SOURCE_LINEAGE_MISMATCH" in b for b in report["blockers"])


def test_missing_or_invalid_manifest_rejected(tmp_path):
    with pytest.raises(ValueError, match="manifest"):
        assess({}, [], tmp_path)
