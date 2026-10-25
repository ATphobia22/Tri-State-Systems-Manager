"""Contract tests for the engineering trust & evidence layer (2026-10-24).

Covers: canonical hashing (including the pasted-stringifier bug case),
gage-datum conversion, HEC-RAS / MODFLOW 6 / Bishop evidence extractors,
replay verification, and the resilient OpenMI exchange wrapper.

Conventions: solver outputs here are FIXTURES, labeled as such. Nothing
executes a solver. HEC-RAS cannot run on this VM.
"""

from __future__ import annotations

import math

from backend.engineering.bishop import BishopSlice
from backend.evidence.canonical_hash import (
    canonical_json,
    hash_payload,
    seal_evidence,
    verify_integrity,
)
from backend.evidence.gage_datum import convert_stage_to_wse
from backend.evidence.replay import verify_replay
from backend.evidence.solver_extractors import (
    HDF5_MAGIC,
    extract_bishop_evidence,
    extract_hec_ras_evidence,
    extract_modflow_evidence,
)
from backend.governance.site_constants import (
    CLAIMED_FREEBOARD_FT,
    REGULATORY_BFE_FT_NAVD88,
)
from backend.openmi_exchange import OpenMiExchange, try_exchange


def test_canonical_json_sorts_nested_keys() -> None:
    # The pasted JSON.stringify array-replacer drops nested keys; the true
    # canonical form keeps every key, sorted at each depth.
    assert canonical_json({"b": {"d": 1, "c": 2}, "a": 1}) == '{"a":1,"b":{"c":2,"d":1}}'
    assert canonical_json([{"z": 1, "a": 2}]) == '[{"a":2,"z":1}]'


def test_seal_and_tamper_detection() -> None:
    sealed = seal_evidence({"run_id": "r1", "status": "VERIFIED"})
    assert verify_integrity(sealed) is True
    tampered = dict(sealed, status="FAILED")
    assert verify_integrity(tampered) is False
    # Sealing is idempotent: resealing does not change the hash.
    assert seal_evidence(sealed)["evidence_bundle_hash"] == sealed["evidence_bundle_hash"]


def test_site_constants_corrected() -> None:
    assert REGULATORY_BFE_FT_NAVD88 == 369.1
    assert CLAIMED_FREEBOARD_FT == 8.1


def test_unpublished_gage_offsets_never_turn_station_altitude_into_water_elevation() -> None:
    # The console likewise marks these station-specific conversions unpublished.
    from backend.governance.site_constants import GAGE_DATUMS_FT_NAVD88
    assert GAGE_DATUMS_FT_NAVD88 == {}
    for station, stage in [("03378500", 15.0), ("03381700", 33.0), ("03322000", 10.0)]:
        result = convert_stage_to_wse(station, stage)
        assert result["status"] == "UNAVAILABLE"
        assert result["wse_ft_navd88"] is None
        assert result["gage_datum_ft_navd88"] is None
        assert "GAGE_DATUM_UNAVAILABLE" in result["reason"]


def test_gage_conversion_unavailable_never_fabricates() -> None:
    assert convert_stage_to_wse("99999999", 10.0)["status"] == "UNAVAILABLE"
    assert convert_stage_to_wse("03378500", 10.0, vertical_datum="NGVD29")["status"] == "UNAVAILABLE"
    assert convert_stage_to_wse("03378500", math.nan)["status"] == "UNAVAILABLE"
    for result in (
        convert_stage_to_wse("99999999", 10.0),
        convert_stage_to_wse("03378500", math.nan),
    ):
        assert result["wse_ft_navd88"] is None


def _real_hdf_bytes() -> bytes:
    return HDF5_MAGIC + b"\x00" * 2048


def test_hec_ras_magic_signature_and_caller_flag_do_not_prove_valid_output() -> None:
    evidence = extract_hec_ras_evidence(
        "run-hec-01", _real_hdf_bytes(), [], "EPSG:2966", "NAVD88", "feet",
        required_profiles_present=True, fixture_label="test-fixture-hdf",
    )
    assert evidence["status"] == "UNVERIFIED"
    assert evidence["verification_scope"].startswith("HDF5_SIGNATURE_ONLY")
    assert evidence["hdf_magic_present"] is True
    assert evidence["fixture_label"] == "test-fixture-hdf"
    assert verify_integrity(evidence) is True


def test_hec_ras_crash_and_bad_magic() -> None:
    crashed = extract_hec_ras_evidence(
        "run-hec-02", _real_hdf_bytes(), ["FATAL COMPUTATION ERROR"], "EPSG:2966", "NAVD88", "feet",
        required_profiles_present=True, fixture_label="test-fixture-hdf",
    )
    assert crashed["status"] == "NON_CONVERGENT"
    not_hdf = extract_hec_ras_evidence(
        "run-hec-03", b"not an hdf file" * 100, [], "EPSG:2966", "NAVD88", "feet",
        required_profiles_present=True, fixture_label="test-fixture-hdf",
    )
    assert not_hdf["status"] == "DATA_ERROR"
    assert not_hdf["hdf_magic_present"] is False


def test_hec_ras_spatial_mismatch_statuses() -> None:
    assert extract_hec_ras_evidence(
        "run-hec-04", _real_hdf_bytes(), [], "EPSG:2966", "NGVD29", "feet",
        required_profiles_present=True, fixture_label="test-fixture-hdf",
    )["status"] == "DATUM_MISMATCH"
    assert extract_hec_ras_evidence(
        "run-hec-05", _real_hdf_bytes(), [], "EPSG:2966", "NAVD88", "",
        required_profiles_present=True, fixture_label="test-fixture-hdf",
    )["status"] == "UNIT_MISMATCH"


def test_modflow_mass_balance_threshold() -> None:
    ok = extract_modflow_evidence(
        "run-mf-01", b"head", b"budget", 0.5, "EPSG:2966", "NAVD88", "feet",
        fixture_label="test-fixture-mf",
    )
    assert ok["status"] == "UNVERIFIED"
    assert ok["mass_balance_provenance"] == "CALLER_SUPPLIED_NOT_PARSED"
    assert ok["mass_balance_threshold_pct"] == 1.0
    bad = extract_modflow_evidence(
        "run-mf-02", b"head", b"budget", 2.5, "EPSG:2966", "NAVD88", "feet",
        fixture_label="test-fixture-mf",
    )
    assert bad["status"] == "NON_CONVERGENT"


def _bishop_slices() -> list[BishopSlice]:
    return [
        BishopSlice(10.0, 10000.0, 0.10, 100.0, 0.50, 0.0),
        BishopSlice(10.0, 15000.0, 0.20, 100.0, 0.50, 0.0),
        BishopSlice(10.0, 12000.0, 0.15, 100.0, 0.50, 0.0),
    ]


def test_bishop_computes_real_factor_of_safety() -> None:
    evidence = extract_bishop_evidence(
        "run-sl-01", _bishop_slices(), "EPSG:2966", "NAVD88", "feet",
        fixture_label="test-fixture-slices",
    )
    assert evidence["status"] == "VERIFIED"
    assert evidence["converged"] is True
    assert evidence["factor_of_safety"] is not None and evidence["factor_of_safety"] > 0
    assert verify_integrity(evidence) is True


def test_replay_equivalence_and_tamper() -> None:
    original = extract_modflow_evidence(
        "run-mf-10", b"head", b"budget", 0.5, "EPSG:2966", "NAVD88", "feet",
        fixture_label="test-fixture-mf",
    )
    replay = extract_modflow_evidence(
        "run-mf-10", b"head", b"budget", 0.5, "EPSG:2966", "NAVD88", "feet",
        fixture_label="test-fixture-mf",
    )
    # Same run id + same inputs: identical evidence, equivalent replay.
    assert verify_replay(original, replay)["equivalent"] is True
    diverged = extract_modflow_evidence(
        "run-mf-10", b"head", b"budget", 2.5, "EPSG:2966", "NAVD88", "feet",
        fixture_label="test-fixture-mf",
    )
    report = verify_replay(original, diverged)
    assert report["equivalent"] is False
    assert report["differences"]
    tampered = dict(original, status="FAILED")
    assert verify_replay(tampered, replay)["equivalent"] is False


def test_openmi_exchange_resilient_not_exception() -> None:
    good = OpenMiExchange(
        quantity="Discharge", unit="cfs", crs="EPSG:2966", vertical_datum="NAVD88",
        timestep="2026-10-24T00:00:00Z", value=255000.0,
        source_component="hec-ras", target_component="modflow",
    )
    result = try_exchange(good, model_run_id="run-om-01", source_authority="USGS")
    assert result["status"] == "OK"
    assert result["message"] is not None
    bad = OpenMiExchange(
        quantity="Discharge", unit="", crs="EPSG:2966", vertical_datum="NAVD88",
        timestep="2026-10-24T00:00:00Z", value=1.0,
    )
    missing = try_exchange(bad, model_run_id="run-om-02", source_authority="USGS")
    assert missing["status"] == "UNAVAILABLE"
    assert missing["message"] is None
    assert "unit" in missing["reason"]

def test_unparsed_hydraulic_outputs_cannot_be_promoted_even_without_fixture_label() -> None:
    # A malicious or mistaken caller can omit fixture_label and claim profiles
    # are present; this must not allow VERIFIED based on 8 magic bytes.
    evidence = extract_hec_ras_evidence(
        "run-untrusted", HDF5_MAGIC + bytes(1024), [], "EPSG:2966",
        "NAVD88", "feet", required_profiles_present=True,
    )
    assert evidence["status"] == "UNVERIFIED"
    assert evidence["fixture_label"] is None

    modflow = extract_modflow_evidence(
        "run-untrusted-mf", b"not-heads", b"not-budget", 0.0,
        "EPSG:2966", "NAVD88", "feet",
    )
    assert modflow["status"] == "UNVERIFIED"
    assert modflow["mass_balance_provenance"] == "CALLER_SUPPLIED_NOT_PARSED"


def test_modflow_rejects_empty_outputs_and_boolean_budget_errors() -> None:
    assert extract_modflow_evidence(
        "mf-empty", b"", b"budget", 0.0, "EPSG:2966", "NAVD88", "feet",
    )["status"] == "DATA_ERROR"
    assert extract_modflow_evidence(
        "mf-bool", b"head", b"budget", True, "EPSG:2966", "NAVD88", "feet",
    )["status"] == "DATA_ERROR"

