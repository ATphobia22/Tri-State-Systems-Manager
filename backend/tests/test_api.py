"""Tests for the TSM companion FastAPI service (backend/app/main.py).

Run from the repo root:  python3 -m pytest backend/tests/test_api.py -v
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "backend"))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import OUTBOX_DIR, QUARANTINE_DIR, app  # noqa: E402

client = TestClient(app)


def canonical(payload: object) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def sample_packet() -> dict:
    return {
        "case_id": "26-05-2022A",
        "artifacts": [
            {"name": "deed.pdf", "sha256": "a" * 64},
            {"name": "elev-cert.pdf", "sha256": "b" * 64},
        ],
    }


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "tsm-companion-api"


def test_evidence_push_accepts_valid_packet(tmp_path, monkeypatch):
    monkeypatch.setattr("app.main.OUTBOX_DIR", tmp_path / "outbox")
    packet = sample_packet()
    claimed = hashlib.sha256(canonical(packet).encode()).hexdigest()
    response = client.post(
        "/api/evidence/push", json={"packet": packet, "packet_sha256": claimed}
    )
    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "received_pending_human_review"
    assert body["packet_sha256"] == claimed
    assert "NOT submitted to FEMA" in body["disclaimer"]
    # receipt_id is deterministic over the packet
    assert body["receipt_id"] == hashlib.sha256(
        (canonical(packet) + "|receipt").encode()
    ).hexdigest()
    # outbox file written with deterministic content
    stored = list((tmp_path / "outbox").glob("*.json"))
    assert len(stored) == 1
    assert stored[0].read_text().strip() == canonical(packet)


def test_evidence_push_rejects_hash_mismatch():
    response = client.post(
        "/api/evidence/push",
        json={"packet": sample_packet(), "packet_sha256": "0" * 64},
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "PACKET_HASH_MISMATCH"


def test_evidence_push_rejects_empty_artifacts():
    packet = {"case_id": "26-05-2022A", "artifacts": []}
    claimed = hashlib.sha256(canonical(packet).encode()).hexdigest()
    response = client.post(
        "/api/evidence/push", json={"packet": packet, "packet_sha256": claimed}
    )
    assert response.status_code == 422


def test_evidence_push_rejects_non_hex_artifact_hash(tmp_path, monkeypatch):
    monkeypatch.setattr("app.main.OUTBOX_DIR", tmp_path / "outbox")
    packet = {
        "case_id": "26-05-2022A",
        "artifacts": [{"name": "x.pdf", "sha256": "z" * 64}],
    }
    claimed = hashlib.sha256(canonical(packet).encode()).hexdigest()
    response = client.post(
        "/api/evidence/push", json={"packet": packet, "packet_sha256": claimed}
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "ARTIFACT_HASH_NOT_HEX"


def test_hydrologic_nodes_serves_registry():
    response = client.get("/api/hydrologic/nodes")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] >= 1
    node = body["nodes"][0]
    assert node["nodeId"]
    assert "no regulatory standing" in body["disclaimer"]


def test_gauge_ingest_quarantines_with_provenance_hash(tmp_path, monkeypatch):
    monkeypatch.setattr("app.main.QUARANTINE_DIR", tmp_path / "quarantine")
    readings = [
        {"node_id": "03378500", "observed_at": "2026-09-26T11:00:00Z", "stage_ft": 12.4},
        {"node_id": "UNWK2", "observed_at": "2026-09-26T11:00:00Z"},
    ]
    response = client.post(
        "/api/webhooks/gauge-ingest",
        json={"source": "usgs-water-services", "readings": readings},
    )
    assert response.status_code == 202
    body = response.json()
    assert body["accepted"] is True
    assert body["quarantined"] == 2
    assert body["human_review_required"] is True
    assert body["authority_class"] == "UNVERIFIED_OBSERVATION"
    expected_hash = hashlib.sha256(canonical(readings[0]).encode()).hexdigest()
    assert body["readings"][0]["provenance_sha256"] == expected_hash
    stored = list((tmp_path / "quarantine").glob("*.json"))
    assert len(stored) == 2


def test_gauge_ingest_rejects_empty_readings():
    response = client.post(
        "/api/webhooks/gauge-ingest",
        json={"source": "usgs-water-services", "readings": []},
    )
    assert response.status_code == 422


def test_gauge_ingest_requires_source():
    response = client.post(
        "/api/webhooks/gauge-ingest",
        json={"readings": [{"node_id": "03378500", "observed_at": "x"}]},
    )
    assert response.status_code == 422
