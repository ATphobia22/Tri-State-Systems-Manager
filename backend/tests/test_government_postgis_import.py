"""Contract tests for hash-gated government GeoJSON -> PostGIS import preparation.

No database or external network is required for these tests.
"""
from __future__ import annotations
import hashlib
import json
import runpy
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "packages/government/scripts/persist_verified_geojson.py"
prepare = runpy.run_path(str(SCRIPT))["prepare"]


def fixture(tmp_path: Path, **overrides):
    data = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "id": "A", "geometry": {"type": "Point", "coordinates": [-87.9, 37.9]},
         "properties": {"source": "test"}}]}
    raw = json.dumps(data).encode()
    path = tmp_path / "source.geojson"
    path.write_bytes(raw)
    manifest = {
        "datasetId": "fema-test", "sourceId": "fema-nfhl", "authority": "FEMA",
        "sourceUrl": "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer",
        "retrievedAt": "2026-11-09T00:00:00Z", "sourceVersion": "test",
        "attribution": "FEMA", "license": "public dataset",
        "horizontalCrs": "EPSG:4326", "classification": "DERIVED",
        "validationStatus": "PASS", "byteLength": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
    }
    manifest.update(overrides)
    mf = tmp_path / "source.manifest.json"
    mf.write_text(json.dumps(manifest))
    return path, mf


def test_verified_hash_and_explicit_source_pass(tmp_path):
    geo, mf = fixture(tmp_path)
    manifest, features, raw = prepare(str(geo), str(mf))
    assert manifest["sourceId"] == "fema-nfhl"
    assert features[0]["id"] == "A"
    assert hashlib.sha256(raw).hexdigest() == manifest["sha256"]


@pytest.mark.parametrize("field,value,error", [
    ("validationStatus", "UNVERIFIED", "INDEPENDENT_VALIDATION"),
    ("horizontalCrs", "EPSG:2966", "REPROJECT_TO_WGS84"),
    ("sha256", "0" * 64, "HASH_OR_LENGTH"),
    ("sourceId", "fake-fema", "SOURCE_AUTHORITY"),
    ("classification", "SCENARIO_SIMULATION_DEMO", "CLASSIFICATION_NOT_ALLOWED"),
])
def test_promotion_rejects_unverified_source(tmp_path, field, value, error):
    geo, mf = fixture(tmp_path, **{field: value})
    with pytest.raises(ValueError, match=error):
        prepare(str(geo), str(mf))
