"""API and evidence-isolation tests for operator-reviewed offline incident overlays."""
from __future__ import annotations

import hashlib
import json

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.geospatial.incident_layers import (
    IncidentLayerError,
    list_incident_layers,
    load_incident_geojson,
)

client = TestClient(app)


def stage(tmp_path, *, coordinate=None, style="circle", authority="OBSERVATION"):
    root = tmp_path / "incident"
    root.mkdir()
    document = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": coordinate or [-88.005, 37.845]},
            "properties": {"facility": "Local bridge", "owner": "PRIVATE INFORMATION",
                           "condition": "unverified", "height_navd88": 376.4},
        }],
    }
    raw = json.dumps(document, sort_keys=True).encode("utf-8")
    (root / "bridges.geojson").write_bytes(raw)
    layer = {
        "id": "bridges", "title": "Observed local bridges",
        "file": "bridges.geojson", "sha256": hashlib.sha256(raw).hexdigest(),
        "source_agency": "Operator-staged public survey",
        "source_url": "https://example.org/metadata",
        "source_license": "Public domain / operator verified",
        "license_reviewed": True, "approved_for_display": True,
        "acquired_at": "2026-11-10T00:00:00Z",
        "attribution": "Operator-staged", "authority_class": authority,
        "style": style, "crs": "EPSG:4326", "vertical_datum": None,
        "display_fields": ["facility", "condition"],
    }
    (root / "layers.json").write_text(json.dumps({
        "schema": "tsm.offline-incident-layers.v1",
        "layers": [layer],
    }))
    return root, layer


def test_missing_staged_data_explicitly_unavailable(tmp_path):
    result = list_incident_layers(tmp_path)
    assert result["state"] == "SOURCE_UNAVAILABLE"
    assert result["layers"] == []


def test_local_approved_data_verified_privacy_limited_and_auditable(tmp_path):
    root, row = stage(tmp_path)
    listed = list_incident_layers(root)
    assert listed["state"] == "MANIFEST_REVIEWED_DATA_UNVERIFIED"
    assert listed["layers"][0]["data_state"] == "VERIFY_ON_REQUEST"
    response = load_incident_geojson("bridges", root)
    props = response["features"][0]["properties"]
    assert props == {"facility": "Local bridge", "condition": "unverified"}
    assert "owner" not in props and "height_navd88" not in props
    assert response["_tsm"]["source_sha256"] == row["sha256"]
    assert response["_tsm"]["regulatory_determination"] is False
    assert response["_tsm"]["human_review_required"] is True


def test_api_connected_to_companion_and_reads_only_local_files(tmp_path, monkeypatch):
    root, _ = stage(tmp_path)
    monkeypatch.setenv("TSM_INCIDENT_LAYERS_ROOT", str(root))
    assert client.get("/api/geospatial/incident-layers").status_code == 200
    r = client.get("/api/geospatial/incident-layers/bridges/geojson")
    assert r.status_code == 200
    assert r.json()["_tsm"]["state"] == "VERIFIED_LOCAL_ADVISORY"
    assert client.get("/api/geospatial/incident-layers/unknown/geojson").status_code == 404


def test_missing_or_tampered_geojson_cannot_be_labeled_verified(tmp_path, monkeypatch):
    root, _ = stage(tmp_path)
    (root / "bridges.geojson").write_text('{"type":"FeatureCollection","features":[]}')
    with pytest.raises(IncidentLayerError, match="SHA-256"):
        load_incident_geojson("bridges", root)
    monkeypatch.setenv("TSM_INCIDENT_LAYERS_ROOT", str(root))
    r = client.get("/api/geospatial/incident-layers/bridges/geojson")
    assert r.status_code == 503
    assert r.json()["detail"]["code"] == "INCIDENT_EVIDENCE_NOT_VERIFIED"


def test_nepal_coordinates_do_not_pass_us_incident_guard(tmp_path):
    root, _ = stage(tmp_path, coordinate=[85.5, 28.3])
    with pytest.raises(IncidentLayerError, match="outside broad Tri-State"):
        load_incident_geojson("bridges", root)


def test_unverified_z_elevations_are_rejected(tmp_path):
    root, _ = stage(tmp_path, coordinate=[-88, 37.8, 370])
    with pytest.raises(IncidentLayerError, match="finite 2D"):
        load_incident_geojson("bridges", root)


@pytest.mark.parametrize("key,value,match", [
    ("authority_class", "REGULATORY", "regulatory authority"),
    ("crs", "EPSG:2966", "EPSG:4326"),
    ("vertical_datum", "NAVD88", "not allowed"),
    ("approved_for_display", False, "review"),
    ("license_reviewed", False, "review"),
    ("file", "../private.geojson", "path traversal"),
    ("file", "https://example.com/flood.geojson", "relative path"),
    ("display_fields", ["owner", "owner"], "allowlist"),
])
def test_invalid_or_unreviewed_manifests_rejected(tmp_path, key, value, match):
    root, _ = stage(tmp_path)
    path = root / "layers.json"
    data = json.loads(path.read_text())
    data["layers"][0][key] = value
    path.write_text(json.dumps(data))
    with pytest.raises(IncidentLayerError, match=match):
        list_incident_layers(root)


def test_duplicate_ids_rejected(tmp_path):
    root, _ = stage(tmp_path)
    path = root / "layers.json"
    data = json.loads(path.read_text())
    data["layers"].append(dict(data["layers"][0]))
    path.write_text(json.dumps(data))
    with pytest.raises(IncidentLayerError, match="duplicate"):
        list_incident_layers(root)


def test_source_geometry_and_style_must_agree(tmp_path):
    root, _ = stage(tmp_path, style="fill")
    with pytest.raises(IncidentLayerError, match="geometry class"):
        load_incident_geojson("bridges", root)


def test_cannot_escape_via_symlink(tmp_path):
    root, _ = stage(tmp_path)
    outside = tmp_path / "outside.geojson"
    outside.write_text((root / "bridges.geojson").read_text())
    (root / "bridges.geojson").unlink()
    try:
        (root / "bridges.geojson").symlink_to(outside)
    except (OSError, NotImplementedError):
        pytest.skip("host does not permit symlinks")
    with pytest.raises(IncidentLayerError, match="symlinked"):
        load_incident_geojson("bridges", root)
