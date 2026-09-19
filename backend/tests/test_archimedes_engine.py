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
    assert result["screening_status"] == "REQUIRES_AUTHORITATIVE_MODEL"


def test_manifest_is_unsigned_without_human_review() -> None:
    result = ArchimedesEngine().evaluate_jurisdiction_compliance(
        "IN", 374.0, 375.0, authoritative_model_id="MODEL-1"
    )
    manifest = ArchimedesEngine().generate_proof_manifest(result)
    assert manifest["governance_status"] == "human_review_required"
    assert manifest["proof_hash_sha256"]
