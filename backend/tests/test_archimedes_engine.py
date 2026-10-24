from backend.governance.archimedes_engine import ArchimedesEngine


def test_indiana_does_not_confuse_state_surcharge_with_fema_no_rise() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "IN",
        stage_ft_navd88=374.5,
        bfe_ft_navd88=375.0,
        floodway_delta_ft=0.10,
        floodway_context="STATE",
        authoritative_model_id="MODEL-1",
        source_evidence_hash="a" * 64,
        rule_set_version="IN-REVIEW-2026-10",
    )
    assert result["screening_status"] == "SCREENED_NO_TRIGGER"
    assert result["human_review_required"] is True
    assert result["regulatory_determination"] is None


def test_indiana_fema_context_flags_any_positive_rise() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "IN",
        stage_ft_navd88=374.5,
        bfe_ft_navd88=375.0,
        floodway_delta_ft=0.01,
        floodway_context="FEMA",
        authoritative_model_id="MODEL-1",
    )
    assert "FEMA_NO_RISE_REVIEW_REQUIRED" in result["flags"]


def test_illinois_does_not_apply_unverified_universal_point_one_threshold() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "IL",
        376.0,
        375.0,
        floodway_delta_ft=0.15,
        authoritative_model_id="MODEL-1",
    )
    assert "ILLINOIS_0_1_FT_THRESHOLD_EXCEEDED" not in result["flags"]
    assert "FLOODWAY_CONTEXT_UNKNOWN" in result["flags"]


def test_kentucky_boundary_rise_criterion_is_not_universal_zero_rise() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "KY",
        375.0,
        375.0,
        floodway_delta_ft=0.01,
        authoritative_model_id="MODEL-1",
    )
    assert "KENTUCKY_NO_IMPACT_NOT_MET" not in result["flags"]
    assert "FLOODWAY_CONTEXT_UNKNOWN" in result["flags"]


def test_missing_model_fails_closed() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "IN", 374.0, 375.0
    )
    assert result["status"] == "EVALUATED"
    assert result["screening_status"] == "SCREENED_WITH_TRIGGERS"
    assert "AUTHORITATIVE_MODEL_NOT_ATTACHED" in result["flags"]


def test_manifest_is_unsigned_without_human_review() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "IN", 374.0, 375.0, authoritative_model_id="MODEL-1"
    )
    manifest = ArchimedesEngine().generate_proof_manifest(result)
    assert manifest["governance_status"] == "BLOCKED_HUMAN_REVIEW_REQUIRED"
    assert manifest["proof_hash_sha256"]



def test_non_finite_and_boolean_numeric_inputs_are_rejected() -> None:
    import math
    import pytest

    engine = ArchimedesEngine()
    for value in (math.inf, -math.inf, math.nan, True):
        with pytest.raises(ValueError):
            engine.evaluate_jurisdiction_compliance("IN", value, 375.0)
    with pytest.raises(ValueError):
        engine.evaluate_jurisdiction_compliance(
            "IN", 374.0, 375.0, floodway_delta_ft=math.inf
        )


def test_proof_manifest_hashes_inputs_and_evaluation_without_claiming_solver() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "IN", 374.0, 375.0, authoritative_model_id="MODEL-1"
    )
    manifest = ArchimedesEngine().generate_proof_manifest(result)

    assert len(manifest["input_hash_sha256"]) == 64
    assert len(manifest["evaluation_hash_sha256"]) == 64
    assert manifest["solver_hash_sha256"] is None
    assert manifest["solver_status"] == "NOT_EVALUATED"
    assert manifest["human_review_status"] == "unsigned"
