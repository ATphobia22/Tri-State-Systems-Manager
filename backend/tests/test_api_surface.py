"""API surface regression tests for the hardened FastAPI companion service."""

from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_hardened_routes_are_real_routes() -> None:
    paths = app.openapi()["paths"]
    assert "/api/geospatial/posey/manifest" in paths
    assert "/api/geospatial/posey/raster" in paths
    assert "/api/engineering/ras-results" in paths
    assert "/api/ledger/append" in paths


def test_ras_route_rejects_invalid_authority_class() -> None:
    payload = {
        "meta": {
            "plan_id": "posey-q100",
            "content_hash_sha256": "a" * 64,
            "authority_class": "REGULATORY_DETERMINATION",
        },
        "cells": [{"id": "c0", "depth_ft": 1.0}],
        "bfe_navd88_ft": 375.0,
        "lag_navd88_ft": 377.2,
    }
    response = client.post("/api/engineering/ras-results", json=payload)
    assert response.status_code == 422


def test_ledger_fails_closed_without_reviewer_allowlist() -> None:
    payload = {
        "artifact_id": "RAS-does-not-exist",
        "human_authorization": {
            "reviewer_identity": "reviewer@example.invalid",
            "authorization_id": "AUTH-1",
            "authorized_at": "2026-10-01T22:00:00Z",
            "reason": "test",
        },
    }
    response = client.post("/api/ledger/append", json=payload)
    assert response.status_code in {404, 503}
