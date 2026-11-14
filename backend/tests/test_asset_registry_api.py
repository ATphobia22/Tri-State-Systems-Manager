"""Source-backed asset/twin MVP regression tests.

These run without PostGIS, MQTT, network access, a native installer or fake
telemetry. The production file is deliberately tested as shipped.
"""
from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from backend.app import asset_registry
from backend.app.main import app

client = TestClient(app)


def _source_document() -> dict:
    return json.loads(asset_registry.SOURCE_PATH.read_text(encoding="utf-8"))


def _write_source(tmp_path: Path, document: dict) -> Path:
    path = tmp_path / "gauge-locations.geojson"
    path.write_text(json.dumps(document, allow_nan=True), encoding="utf-8")
    return path


def test_checked_in_station_inventory_is_real_and_deterministic() -> None:
    first = asset_registry.build_registry_snapshot()
    second = asset_registry.build_registry_snapshot()
    assert first == second
    assert first["schemaVersion"] == "1.0.0"
    assert first["count"] == 10
    assert first["count"] == len(first["assets"])
    assert first["sourceSha256"] == hashlib.sha256(
        asset_registry.SOURCE_PATH.read_bytes()
    ).hexdigest()
    ids = [asset["assetId"] for asset in first["assets"]]
    assert ids == sorted(set(ids))
    assert "USGS-03378500" in ids
    assert "USGS-03322000" in ids
    for item in first["assets"]:
        assert item["evidenceClass"] == "SOURCE_STAGED_LOCATION_ONLY"
        assert item["spatialReference"]["crs"] == "EPSG:4326"
        assert item["spatialReference"]["verticalDatum"] is None
        assert item["currentObservation"] is None
        assert item["observationTimestamp"] is None
        assert item["instrumentHealth"] is None


def test_asset_and_twin_routes_share_exact_source_receipt() -> None:
    listed = client.get("/api/assets")
    assert listed.status_code == 200
    data = listed.json()
    assert data["total"] == 10
    assert data["assets"][0]["assetId"].startswith("USGS-")
    assert len(data["sourceSha256"]) == 64
    detail = client.get("/api/assets/USGS-03378500")
    assert detail.status_code == 200
    assert detail.json()["sourceSha256"] == data["sourceSha256"]
    assert detail.json()["asset"]["name"] == "Wabash River at New Harmony, IN"
    twin = client.get("/api/twins/USGS-03378500")
    assert twin.status_code == 200
    body = twin.json()
    assert body["stateStatus"] == "NOT_EVALUATED"
    assert body["currentState"] is None
    assert body["observationStatus"] == "NOT_FETCHED"
    assert body["observations"] == []
    assert body["relationships"] == []
    assert body["sourceSha256"] == data["sourceSha256"]


def test_list_is_bounded_and_unknown_asset_is_404() -> None:
    response = client.get("/api/assets?offset=1&limit=2")
    assert response.status_code == 200
    assert len(response.json()["assets"]) == 2
    assert response.json()["offset"] == 1
    assert client.get("/api/assets?limit=1001").status_code == 422
    assert client.get("/api/assets?offset=-1").status_code == 422
    assert client.get("/api/assets/USGS-00000000").status_code == 404
    assert client.get("/api/twins/INVALID-33").status_code == 404


@pytest.mark.parametrize("mutator,reason", [
    (lambda d: d.update(crs="EPSG:3857"), "SOURCE_CRS_NOT_EPSG_4326"),
    (lambda d: d["features"].append(copy.deepcopy(d["features"][0])), "DUPLICATE_STATION_ID"),
    (lambda d: d["features"][0]["geometry"].update(coordinates=[-999.0, 38.0]), "WGS84_COORDINATES_OUT_OF_RANGE"),
    (lambda d: d["features"][0]["properties"].update(sourceUri="https://evil.example/monitoring-location/USGS-03378500/"), "UNTRUSTED_STATION_SOURCE_URI"),
    (lambda d: d["features"][0]["properties"].update(locationOnly=False), "STATION_LOCATION_CONTRACT_MISMATCH"),
    (lambda d: d["features"][0]["geometry"].update(coordinates=[float("nan"), 38.0]), "NONFINITE_WGS84_COORDINATES"),
])
def test_invalid_source_never_yields_partial_assets(tmp_path, mutator, reason) -> None:
    payload = _source_document()
    mutator(payload)
    candidate = _write_source(tmp_path, payload)
    with pytest.raises(asset_registry.AssetRegistrySourceError, match=reason):
        asset_registry.build_registry_snapshot(candidate)




def test_machine_readable_schema_accepts_export_contract() -> None:
    root = Path(__file__).resolve().parents[2]
    schema = json.loads((root / "schemas/regional-asset-snapshot-v1.schema.json").read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema).validate(asset_registry.build_registry_snapshot())


def test_cli_exports_deterministic_offline_asset_json(tmp_path) -> None:
    import subprocess
    import sys

    root = Path(__file__).resolve().parents[2]
    out = tmp_path / "offline-stations.json"
    subprocess.run(
        [sys.executable, "-m", "backend.app.asset_registry", "--output", str(out)],
        cwd=root, check=True, capture_output=True, text=True,
    )
    exported = json.loads(out.read_text(encoding="utf-8"))
    assert exported == asset_registry.build_registry_snapshot()


def test_empty_and_malformed_port_sources_reject_entire_file(tmp_path) -> None:
    empty = _source_document()
    empty["features"] = []
    with pytest.raises(asset_registry.AssetRegistrySourceError, match="INVALID_FEATURE_COUNT"):
        asset_registry.build_registry_snapshot(_write_source(tmp_path, empty))

    malformed = _source_document()
    malformed["features"][0]["properties"]["sourceUri"] = (
        "https://waterdata.usgs.gov:badport/monitoring-location/USGS-03378500/"
    )
    with pytest.raises(asset_registry.AssetRegistrySourceError, match="UNTRUSTED_STATION_SOURCE_URI"):
        asset_registry.build_registry_snapshot(_write_source(tmp_path, malformed))

def test_unavailable_source_reports_503_without_lying_about_health(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(asset_registry, "SOURCE_PATH", tmp_path / "missing.geojson")
    response = client.get("/api/assets")
    assert response.status_code == 503
    body = response.json()["detail"]
    assert body["code"] == "ASSET_SOURCE_UNAVAILABLE"
    assert body["dataState"] == "UNAVAILABLE"
    assert client.get("/api/twins/USGS-03378500").status_code == 503


def test_source_size_guard_rejects_unbounded_input(tmp_path) -> None:
    path = tmp_path / "oversize.geojson"
    path.write_bytes(b"x" * (asset_registry.MAX_SOURCE_BYTES + 1))
    with pytest.raises(asset_registry.AssetRegistrySourceError, match="SOURCE_TOO_LARGE"):
        asset_registry.build_registry_snapshot(path)


def test_openapi_describes_asset_and_twin_routes() -> None:
    paths = app.openapi()["paths"]
    for name in ("/api/assets", "/api/assets/{asset_id}", "/api/twins/{asset_id}"):
        assert name in paths
        assert "get" in paths[name]
