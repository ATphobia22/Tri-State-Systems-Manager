"""No-network regression tests for Posey geospatial ingestion and public API."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.geospatial import posey_stack

SCRIPT = Path(__file__).resolve().parents[2] / "scripts/geospatial/posey_source_ingest.py"
SPEC = importlib.util.spec_from_file_location("posey_source_ingest", SCRIPT)
assert SPEC and SPEC.loader
ingest = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ingest)


def test_openapi_has_source_layer_and_feature_reads():
    paths = posey_stack.app.openapi()["paths"]
    assert "/api/geospatial/posey-stack/sources" in paths
    assert "/api/geospatial/posey-stack/layers" in paths
    assert "/api/geospatial/posey-stack/layers/{source_id}/features" in paths


@pytest.mark.parametrize("bbox", [
    "-87.9,37.9,-87.8,38.0,0", "NaN,37.9,-87.8,38.0",
    "-89.5,37.9,-87.8,38.0", "-87.8,37.9,-87.9,38.0",
    "-88,37.9,-87.8,37.8", "-88,37.0,-87.8,39.0",
])
def test_bbox_rejects_bad_or_unbounded_values(bbox):
    with pytest.raises(HTTPException) as err:
        posey_stack.parse_posey_bbox(bbox)
    assert err.value.status_code == 422


def test_bbox_valid_for_downtown_mount_vernon():
    assert posey_stack.parse_posey_bbox("-87.92,37.91,-87.87,37.95") == (
        -87.92, 37.91, -87.87, 37.95)


def test_public_property_whitelist_hides_private_parcel_info():
    data = {"OBJECTID": 2, "parcel_id": "1234", "OwnerName": "Private Person",
            "mailing_address": "Private", "tax_value": 234}
    cleaned = posey_stack._public_properties(data, "parcel")
    assert cleaned == {"OBJECTID": 2, "parcel_id": "1234"}


def test_read_api_explicit_unconfigured_database(monkeypatch):
    monkeypatch.delenv("TSM_GEOSPATIAL_DSN", raising=False)
    resp = TestClient(posey_stack.app).get("/api/geospatial/posey-stack/sources")
    assert resp.status_code == 503
    assert resp.json()["detail"]["code"] in {
        "GEOSPATIAL_DATABASE_NOT_CONFIGURED", "PSYCOPG_UNAVAILABLE"}


def test_invalid_bbox_before_db_lookup():
    resp = TestClient(posey_stack.app).get(
        "/api/geospatial/posey-stack/layers/igio-buildings/features",
        params={"bbox": "0,0,180,90"})
    assert resp.status_code == 422


def test_county_shape_reads_exact_census_polygon():
    county = ingest.county_shape()
    from shapely.geometry import Point
    assert county.intersects(Point(-87.895, 37.93))
    assert not county.intersects(Point(-87.2, 37.93))


def test_local_geojson_boundary_filter_and_hash():
    payload = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "id": "inside", "geometry": {
            "type": "Point", "coordinates": [-87.895, 37.93]}, "properties": {"x": "ok"}},
        {"type": "Feature", "id": "outside", "geometry": {
            "type": "Point", "coordinates": [-87.2, 37.93]}, "properties": {"x": "no"}}]}
    records = ingest.check_features(json.dumps(payload).encode())
    assert len(records) == 1 and records[0][0] == "inside"


def test_upstream_allowlist_cannot_fetch_unregistered_or_malicious_host():
    with pytest.raises(ValueError, match="UPSTREAM_HOST_OR_PATH_NOT_ALLOWED"):
        ingest.fetch_arcgis({"source_id": "igio-roads", "ingest_mode": "ARCGIS_GEOJSON",
                             "endpoint": "https://evil.example/FeatureServer/0"})
    with pytest.raises(ValueError, match="LIVE_FETCH_NOT_APPROVED_FOR_SOURCE"):
        ingest.fetch_arcgis({"source_id": "usace-nld", "ingest_mode": "LOCAL_GEOJSON",
                             "endpoint": "https://geospatial.sec.usace.army.mil/dls"})


def test_manifest_explicit_crs_timestamp_and_host_required():
    src = {"endpoint": "https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0",
           "ingest_mode": "ARCGIS_GEOJSON"}
    meta = {"sourceUrl": src["endpoint"], "retrievedAt": "2026-11-23T12:00:00Z",
            "license": "REVIEW_REQUIRED", "attribution": "Indiana GIO",
            "horizontalCrs": "EPSG:4326", "evidenceClass": "SOURCE_REFERENCE"}
    ingest.manifest_check(meta, src)
    with pytest.raises(ValueError, match="RETRIEVAL_TIMESTAMP"):
        ingest.manifest_check({**meta, "retrievedAt": "2026-11-23T12:00:00"}, src)
    with pytest.raises(ValueError, match="MANIFEST_HOST"):
        ingest.manifest_check({**meta, "sourceUrl": "https://evil.example/feature"}, src)
    with pytest.raises(ValueError, match="VECTOR_MUST_BE_REPROJECTED"):
        ingest.manifest_check({**meta, "horizontalCrs": "EPSG:2966"}, src)


def test_reviewer_allowlist_missing_denies_before_db_calls(monkeypatch):
    monkeypatch.delenv("TSM_REVIEWER_SUBJECTS", raising=False)
    with pytest.raises(ValueError, match="REVIEWER_NOT_AUTHORIZED"):
        ingest.approve(None, "any-uuid", "not-listed", "Valid rationale for review",
                       "Review license")
