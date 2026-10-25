import copy

import pytest

from backend.governance.archimedes_engine import ArchimedesEngine, ENGINE_VERSION

HASH = "a" * 64
VALID = {
    "authoritative_model_id": "MODEL-1",
    "source_evidence_hash": HASH,
    "solver_status": "SUCCESS",
    "input_freshness": "FRESH",
}


def test_indiana_uses_015_criterion_but_requires_human_review() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "IN", 374.5, 375.0, floodway_delta_ft=0.10, floodway_context="STATE", **VALID
    )
    assert result["screening_status"] == "SCREENED_NO_TRIGGER"
    assert result["human_review_required"] is True
    assert result["regulatory_determination"] is None


def test_indiana_criterion_is_triggered_at_inclusive_boundary() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "IN", 374.5, 375.0, floodway_delta_ft=0.15, floodway_context="STATE", **VALID
    )
    assert "INDIANA_0_15_FT_CRITERION_REACHED" in result["flags"]


def test_indiana_fema_context_flags_any_positive_rise() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "IN", 374.5, 375.0, floodway_delta_ft=0.01, floodway_context="FEMA", **VALID
    )
    assert "FEMA_NO_RISE_REVIEW_REQUIRED" in result["flags"]


def test_illinois_urban_threshold_and_rural_threshold_are_distinct() -> None:
    engine = ArchimedesEngine()
    urban = engine.evaluate_jurisdiction_compliance(
        "IL", 374.0, 375.0, floodway_delta_ft=0.15,
        floodway_context="ILLINOIS_URBAN", **VALID
    )
    rural = engine.evaluate_jurisdiction_compliance(
        "IL", 374.0, 375.0, floodway_delta_ft=0.15,
        floodway_context="ILLINOIS_RURAL", **VALID
    )
    assert "ILLINOIS_CONTEXT_THRESHOLD_EXCEEDED" in urban["flags"]
    assert "ILLINOIS_CONTEXT_THRESHOLD_EXCEEDED" not in rural["flags"]


def test_kentucky_no_impact_screen_flags_positive_rise() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "KY", 375.0, 375.0, floodway_delta_ft=0.01, floodway_context="STATE", **VALID
    )
    assert "KENTUCKY_NO_IMPACT_NOT_MET" in result["flags"]


@pytest.mark.parametrize(
    ("overrides", "expected_flag"),
    [
        ({"authoritative_model_id": None}, "AUTHORITATIVE_MODEL_NOT_ATTACHED"),
        ({"source_evidence_hash": None}, "SOURCE_EVIDENCE_HASH_MISSING"),
        ({"solver_status": "FAILED"}, "SOLVER_STATUS_FAILED"),
        ({"solver_status": "MISSING"}, "SOLVER_STATUS_MISSING"),
        ({"solver_status": "STALE"}, "SOLVER_STATUS_STALE"),
        ({"input_freshness": "STALE"}, "INPUT_FRESHNESS_STALE"),
        ({"input_freshness": "MISSING"}, "INPUT_FRESHNESS_MISSING"),
        ({"input_freshness": "UNKNOWN"}, "INPUT_FRESHNESS_UNKNOWN"),
        ({"stage_ft_navd88": None}, "REQUIRED_ELEVATION_INPUT_MISSING"),
        ({"floodway_context": "UNKNOWN"}, "FLOODWAY_CONTEXT_UNKNOWN"),
    ],
)
def test_missing_or_untrusted_inputs_fail_closed(overrides, expected_flag) -> None:
    kwargs = {**VALID, **overrides}
    stage = kwargs.pop("stage_ft_navd88", 374.0)
    bfe = kwargs.pop("bfe_ft_navd88", 375.0)
    context = kwargs.pop("floodway_context", "STATE")
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "IN", stage, bfe, floodway_delta_ft=0.1,
        floodway_context=context, **kwargs
    )
    assert result["status"] == "NOT_EVALUATED"
    assert result["screening_status"] == "NOT_EVALUATED"
    assert expected_flag in result["reasons"]
    assert result["regulatory_determination"] is None


@pytest.mark.parametrize("bad_value", [float("nan"), float("inf"), float("-inf"), True])
def test_nonfinite_and_boolean_engineering_values_are_rejected(bad_value) -> None:
    with pytest.raises(ValueError):
        ArchimedesEngine().evaluate_jurisdiction_compliance(
            "IN", bad_value, 375.0, floodway_context="STATE", **VALID
        )


def test_invalid_source_digest_is_rejected() -> None:
    with pytest.raises(ValueError):
        ArchimedesEngine().evaluate_jurisdiction_compliance(
            "IN", 374.0, 375.0, floodway_context="STATE",
            **{**VALID, "source_evidence_hash": "not-a-digest"}
        )


def test_proof_manifest_is_deterministic_for_same_evaluation() -> None:
    engine = ArchimedesEngine(node_id="test-node")
    result = engine.evaluate_jurisdiction_compliance(
        "IN", 374.0, 375.0, floodway_delta_ft=0.1,
        floodway_context="STATE", **VALID
    )
    first = engine.generate_proof_manifest(result)
    second = engine.generate_proof_manifest(result)
    assert first == second
    assert len(first["proof_hash_sha256"]) == 64
    assert engine.verify_proof_manifest(first) is True


def test_manifest_mutation_is_detected() -> None:
    engine = ArchimedesEngine()
    result = engine.evaluate_jurisdiction_compliance(
        "KY", 374.0, 375.0, floodway_delta_ft=0.0,
        floodway_context="STATE", **VALID
    )
    manifest = engine.generate_proof_manifest(result)
    changed = copy.deepcopy(manifest)
    changed["evaluation_body"]["clearance_metrics"]["bfe_ft_navd88"] = 999.0
    assert engine.verify_proof_manifest(changed) is False


def test_reviewer_metadata_does_not_claim_authorization_or_signature() -> None:
    engine = ArchimedesEngine()
    result = engine.evaluate_jurisdiction_compliance(
        "IN", 374.0, 375.0, floodway_context="STATE", **VALID
    )
    manifest = engine.generate_proof_manifest(
        result, reviewer_identity="reviewer-123", review_reason="Peer review recorded"
    )
    assert manifest["governance_status"] == "human_review_required"
    assert manifest["human_review_status"] == "review_metadata_recorded"
    assert engine.verify_proof_manifest(manifest) is True


def test_manifest_rejects_partial_reviewer_metadata() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "IN", 374.0, 375.0, floodway_context="STATE", **VALID
    )
    with pytest.raises(ValueError):
        ArchimedesEngine().generate_proof_manifest(result, reviewer_identity="reviewer-123")


def test_manifest_rejects_unknown_engine_version() -> None:
    with pytest.raises(ValueError):
        ArchimedesEngine().generate_proof_manifest({"engine": "unknown"})
