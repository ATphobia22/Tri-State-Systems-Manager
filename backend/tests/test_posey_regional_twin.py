"""Deterministic unit and optional real-PostGIS tests for the regional twin slice."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.api.v1 import regional_twin
from backend.geospatial import posey_sync, twin_import, twin_publish
from backend.geospatial.twin_server import app

API = TestClient(app)
SOURCE = posey_sync.SOURCES["igio-buildings"][0]


def fake_arcgis(_client, url, params):
    if url == posey_sync.COUNTY_URL + "/query":
        assert params["where"] == "fips = '18129'"
        return {"features": [{"geometry": {"rings": [
            [[-88.1, 37.75], [-87.7, 37.75], [-87.7, 38.1],
             [-88.1, 38.1], [-88.1, 37.75]]
        ]}}]}
    if url == SOURCE and params.get("f") == "json":
        return {"name": "CI-SYNTHETIC-FOOTPRINTS",
                "objectIdField": "OBJECTID", "maxRecordCount": 2000}
    assert url == SOURCE + "/query"
    assert params["geometryType"] == "esriGeometryPolygon"
    if params.get("returnCountOnly") == "true":
        return {"count": 2}
    assert params["outSR"] == "4326"
    return {"type": "FeatureCollection", "features": [
        {"type": "Feature", "id": 101, "properties": {
            "OBJECTID": 101, "county": "Posey", "owner": "DO_NOT_PUBLISH"},
         "geometry": {"type": "Polygon", "coordinates": [[
             [-87.94, 37.9], [-87.939, 37.9], [-87.939, 37.901],
             [-87.94, 37.901], [-87.94, 37.9]]] }},
        {"type": "Feature", "id": 102, "properties": {
            "OBJECTID": 102, "county": "Posey"},
         "geometry": {"type": "Polygon", "coordinates": [[
             [-87.93, 37.9], [-87.929, 37.9], [-87.929, 37.901],
             [-87.93, 37.901], [-87.93, 37.9]]] }},
    ]}


def staged(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(posey_sync, "_get_json", fake_arcgis)
    receipt = posey_sync.stage("igio-buildings", tmp_path, client=object())
    path = Path(receipt["geojson"])
    manifest_path = Path(receipt["manifest"])
    manifest = json.loads(manifest_path.read_text())
    return receipt, path, manifest_path, manifest


def reviewed(tmp_path: Path, monkeypatch):
    receipt, path, manifest_path, manifest = staged(tmp_path, monkeypatch)
    manifest.update({
        "validationStatus": "PASS", "licenseReviewed": True,
        "license": "Test fixture only; no government data licensed by this test",
        "reviewId": "CI-SYNTHETIC-REVIEW-NOT-A-HUMAN-ATTESTATION",
    })
    manifest_path.write_text(json.dumps(manifest))
    return receipt, path, manifest_path, manifest


def test_official_county_spatial_filter_and_immutable_snapshot(tmp_path, monkeypatch):
    receipt, path, manifest_path, manifest = staged(tmp_path, monkeypatch)
    assert receipt["count"] == 2
    assert manifest["countyFips"] == "18129"
    assert manifest["validationStatus"] == "UNVERIFIED"
    assert manifest["licenseReviewed"] is False
    assert hashlib.sha256(path.read_bytes()).hexdigest() == receipt["sha256"]
    with pytest.raises(FileExistsError, match="IMMUTABLE"):
        posey_sync.stage("igio-buildings", tmp_path, client=object())
    with pytest.raises(ValueError, match="INDEPENDENT_VALIDATION"):
        twin_import.prepare(path, manifest_path)


def test_count_mismatch_rejected_without_staging(tmp_path, monkeypatch):
    def truncated(client, url, params):
        data = fake_arcgis(client,url,params)
        if url == SOURCE + "/query" and params.get("f") == "geojson":
            data["features"] = data["features"][:1]
        return data
    monkeypatch.setattr(posey_sync, "_get_json", truncated)
    with pytest.raises(ValueError, match="TRUNCATED"):
        posey_sync.stage("igio-buildings", tmp_path, client=object())
    assert not tmp_path.exists()


def test_review_and_hash_required(tmp_path, monkeypatch):
    _, path, manifest_path, manifest = reviewed(tmp_path, monkeypatch)
    record, features = twin_import.prepare(path, manifest_path)
    assert record["sourceId"] == "igio-buildings" and len(features) == 2
    with path.open("ab") as out:
        out.write(b"\n")
    with pytest.raises(ValueError, match="HASH_OR_LENGTH"):
        twin_import.prepare(path, manifest_path)


def test_coordinates_crs_and_capture_dates_enforced(tmp_path, monkeypatch):
    _, path, manifest_path, manifest = reviewed(tmp_path, monkeypatch)
    manifest["horizontalCrs"] = "EPSG:2966"
    manifest_path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="WGS84"):
        twin_import.prepare(path,manifest_path)
    manifest["horizontalCrs"] = "EPSG:4326"
    manifest["assetKind"] = "ORTHOPHOTO"
    manifest_path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="captureStart"):
        twin_import.prepare(path,manifest_path)


def test_public_geometry_redacts_parcel_owners():
    data = {"parcel_id": "P-1", "state_parcel_id": "18129-1",
            "owner": "PRIVATE PERSON", "mail_address": "DO NOT DISPLAY"}
    safe = regional_twin._properties("igio-parcels", data)
    assert safe == {"parcel_id": "P-1", "state_parcel_id": "18129-1"}
    assert regional_twin._properties("unknown", data) == {}


@pytest.mark.parametrize("raw", [
    "NaN,37,-87,38", "-89,37,-86,38", "-88,38,-89,37",
    "-88,37,-87,INF", "junk", "1,2,3", "0,0,5,5",
])
def test_unbounded_and_invalid_bbox_rejected(raw):
    with pytest.raises(Exception):
        regional_twin._bbox(raw)


def test_standalone_api_is_mounted_and_unconfigured_fails_explicitly(monkeypatch):
    monkeypatch.delenv("TSM_POSTGIS_DSN",raising=False)
    paths = app.openapi()["paths"]
    assert "/api/geospatial/twin/sources" in paths
    assert "/api/geospatial/twin/features/{asset_id}" in paths
    for endpoint in ("/api/geospatial/twin/health", "/api/geospatial/twin/assets"):
        resp = API.get(endpoint)
        assert resp.status_code == 503
        assert resp.json()["detail"]["code"] == "TWIN_DATABASE_UNCONFIGURED"
    resp = API.get("/api/geospatial/twin/features/example?bbox=bad")
    assert resp.status_code == 422


def test_publication_fails_closed_without_local_reviewer_allowlist(tmp_path,monkeypatch):
    proof = tmp_path / "review.txt"
    proof.write_text("This is a synthetic reviewer test record. Not a signature.")
    monkeypatch.delenv("TSM_TWIN_REVIEWER_SUBJECTS",raising=False)
    with pytest.raises(PermissionError,match="ALLOWLIST"):
        twin_publish.publish("test-asset","tester",proof,"test only")


@pytest.mark.skipif(not os.getenv("TSM_TEST_POSTGIS_DSN"),
                    reason="Real PostGIS integration requires TSM_TEST_POSTGIS_DSN")
def test_real_postgis_import_publish_public_query(tmp_path, monkeypatch):
    import psycopg2
    dsn = os.environ["TSM_TEST_POSTGIS_DSN"]
    monkeypatch.setenv("TSM_POSTGIS_DSN",dsn)
    monkeypatch.setenv("TSM_TWIN_REVIEWER_SUBJECTS","ci-tester")
    receipt,path,manifest_path,manifest = reviewed(tmp_path,monkeypatch)
    imported = twin_import.persist(path,manifest_path,
                                   object_store=tmp_path / "objects")
    assert imported["featureCount"] == 2
    assert imported["result"] == "IMPORTED_NOT_PUBLISHED"
    assert API.get("/api/geospatial/twin/health").status_code == 200
    response = API.get("/api/geospatial/twin/assets")
    assert response.status_code == 200
    assert receipt["assetId"] not in [x["asset_id"] for x in response.json()["data"]]
    proof = tmp_path / "reviewer-receipt.txt"
    proof.write_text("Synthetic CI fixture. No human certification. "+("x"*64))
    approval = twin_publish.publish(receipt["assetId"],"ci-tester",proof,
                                    "Synthetic CI public read regression")
    assert approval["publicationStatus"] == "APPROVED_FOR_VIEW"
    response = API.get("/api/geospatial/twin/assets")
    assert receipt["assetId"] in [x["asset_id"] for x in response.json()["data"]]
    feat = API.get(f"/api/geospatial/twin/features/{receipt['assetId']}"
                   "?bbox=-88.0,37.8,-87.8,38.0")
    assert feat.status_code == 200
    assert len(feat.json()["features"]) == 2
    assert "owner" not in feat.json()["features"][0]["properties"]
    dims = API.get(f"/api/geospatial/twin/buildings/{receipt['assetId']}/101/dimensions")
    assert dims.status_code == 404
    with psycopg2.connect(dsn) as db:
        assert db.cursor().execute("SELECT 1") is None
        try:
            with db.cursor() as cur:
                cur.execute("DELETE FROM twin_geo.review_event WHERE asset_id=%s",
                            (receipt["assetId"],))
        except psycopg2.Error as error:
            assert "TWIN_REVIEW_EVENTS_ARE_APPEND_ONLY" in str(error)
            db.rollback()
        else:
            raise AssertionError("Review ledger deletion should be blocked")
