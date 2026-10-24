from backend.governance.archimedes_engine import ArchimedesEngine


def test_indiana_uses_dnr_015_threshold_but_requires_human_review() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "IN",
        stage_ft_navd88=374.5,
        bfe_ft_navd88=375.0,
        floodway_delta_ft=0.10,
        authoritative_model_id="MODEL-1",
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


def test_illinois_uses_point_one_foot_screen() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "IL",
        376.0,
        375.0,
        floodway_delta_ft=0.15,
        authoritative_model_id="MODEL-1",
    )
    assert "ILLINOIS_0_1_FT_THRESHOLD_EXCEEDED" in result["flags"]


def test_kentucky_requires_no_impact_for_encroachment_screen() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "KY",
        375.0,
        375.0,
        floodway_delta_ft=0.01,
        authoritative_model_id="MODEL-1",
    )
    assert "KENTUCKY_NO_IMPACT_NOT_MET" in result["flags"]


def test_missing_model_fails_closed() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "IN", 374.0, 375.0
    )
    assert result["status"] == "NOT_EVALUATED"
    assert result["screening_status"] == "NOT_EVALUATED"
    assert result["compliant"] is False
    assert "authoritative model identifier is missing" in result["reasons"][0]


def test_manifest_is_unsigned_without_human_review() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "IN", 374.0, 375.0, authoritative_model_id="MODEL-1"
    )
    manifest = ArchimedesEngine().generate_proof_manifest(result)
    assert manifest["governance_status"] == "human_review_required"
    assert manifest["human_review_status"] == "unsigned"
    assert manifest["proof_hash_sha256"]


def test_non_finite_numeric_inputs_are_rejected() -> None:
    engine = ArchimedesEngine()
    for value in (float("nan"), float("inf"), float("-inf")):
        try:
            engine.evaluate_jurisdiction_compliance(
                "IN", value, 375.0, authoritative_model_id="MODEL-1"
            )
        except ValueError as exc:
            assert "finite numbers" in str(exc)
        else:
            raise AssertionError(f"non-finite stage {value!r} must be rejected")


def test_failed_solver_blocks_gate() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "IN",
        stage_ft_navd88=374.5,
        bfe_ft_navd88=375.0,
        authoritative_model_id="MODEL-1",
        solver_status="FAILED",
    )
    assert result["status"] == "GATE_BLOCKED_BY_SOLVER_ERROR"
    assert result["screening_status"] == "NOT_EVALUATED"
    assert result["clearance_metrics"] is None


def test_review_metadata_does_not_claim_signature_or_authorization() -> None:
    engine = ArchimedesEngine()
    evaluation = engine.evaluate_jurisdiction_compliance(
        "IN", 374.0, 375.0, authoritative_model_id="MODEL-1"
    )
    manifest = engine.generate_proof_manifest(
        evaluation, reviewer_identity="PE Example", review_reason="Reviewed for demonstration"
    )
    assert manifest["governance_status"] == "human_review_required"
    assert manifest["human_review_status"] == "recorded_unverified"
    assert "not a digital signature" in manifest["disclaimer"]
