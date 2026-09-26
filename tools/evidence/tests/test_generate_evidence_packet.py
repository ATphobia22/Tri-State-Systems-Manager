"""Tests for tools/evidence/generate_evidence_packet.py."""
import hashlib
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from generate_evidence_packet import (  # noqa: E402
    build_packet,
    canonical_json,
    validate_site,
)

VALID_SITE = {
    "location_address": "13101 BONEBANK RD, MOUNT VERNON, IN 47620",
    "latitude": 37.845887,
    "longitude": -88.005075,
    "panel_id": "18129C0265C",
    "calculated_lag_navd88_ft": 377.2,
    "effective_bfe_navd88_ft": 368.7,
    "source_authority": "Indiana Geographic Information Office",
    "source_uri": "https://www.indianamap.org",
    "source_dataset": "IGIO_2016_2020_DEM",
    "verifier": "test-operator",
}


def test_deterministic_hash():
    p1 = build_packet(VALID_SITE, "ev-test-001", "2026-09-25T12:00:00Z")
    p2 = build_packet(VALID_SITE, "ev-test-001", "2026-09-25T12:00:00Z")
    assert p1["content_hash_sha256"] == p2["content_hash_sha256"]
    assert len(p1["content_hash_sha256"]) == 64


def test_hash_covers_payload():
    packet = build_packet(VALID_SITE, "ev-test-001", "2026-09-25T12:00:00Z")
    expected = hashlib.sha256(canonical_json(packet["payload"])).hexdigest()
    assert packet["content_hash_sha256"] == expected


def test_freeboard_computed():
    packet = build_packet(VALID_SITE, "ev-test-001", "2026-09-25T12:00:00Z")
    assert packet["payload"]["freeboard_ft"] == pytest.approx(8.5)


def test_schema_required_keys_present():
    packet = build_packet(VALID_SITE, "ev-test-001", "2026-09-25T12:00:00Z")
    required = [
        "artifact_id", "artifact_type", "source_authority", "source_uri",
        "retrieved_at", "spatial_reference", "vertical_reference",
        "content_hash_sha256", "parent_artifacts", "transformation_chain",
        "validation_status", "authority_class", "derivation_class",
        "governance_status",
    ]
    for key in required:
        assert key in packet, f"missing schema-required key: {key}"


def test_always_human_review():
    packet = build_packet(VALID_SITE, "ev-test-001", "2026-09-25T12:00:00Z")
    assert packet["governance_status"] == "human_review_required"
    assert packet["validation_status"] == "provisional"


def test_fail_closed_missing_field():
    bad = dict(VALID_SITE)
    del bad["panel_id"]
    with pytest.raises(ValueError, match="fail-closed"):
        build_packet(bad, "ev-test-001")


def test_fail_closed_bad_coordinates():
    bad = dict(VALID_SITE, latitude=95.0)
    with pytest.raises(ValueError, match="fail-closed"):
        build_packet(bad, "ev-test-001")


def test_fail_closed_non_numeric_lag():
    bad = dict(VALID_SITE, calculated_lag_navd88_ft="high")
    with pytest.raises(ValueError, match="fail-closed"):
        build_packet(bad, "ev-test-001")


def test_fail_closed_empty_panel():
    bad = dict(VALID_SITE, panel_id="  ")
    with pytest.raises(ValueError, match="fail-closed"):
        build_packet(bad, "ev-test-001")


def test_validate_site_rejects_non_dict():
    with pytest.raises(ValueError, match="fail-closed"):
        validate_site(["not", "a", "dict"])
