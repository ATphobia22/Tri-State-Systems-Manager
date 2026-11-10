"""Synthetic-only deterministic incident screening tests; no real flood claims."""
from __future__ import annotations

import hashlib
import json

import pytest

from backend.geospatial.offline_exposure import (
    ExposureScreeningError, screen_local_exposure,
)
from backend.geospatial.incident_layers import IncidentLayerError


def _feature(kind, coordinates):
    return {"type": "Feature", "geometry": {"type": kind, "coordinates": coordinates},
            "properties": {"name": "Synthetic test only", "private_owner": "DO NOT EMIT"}}


def _write(root, layer_id, features, style):
    raw = json.dumps({"type": "FeatureCollection", "features": features}).encode()
    (root / f"{layer_id}.geojson").write_bytes(raw)
    return {
        "id": layer_id, "title": f"Synthetic {layer_id}",
        "file": f"{layer_id}.geojson", "sha256": hashlib.sha256(raw).hexdigest(),
        "source_agency": "Synthetic fixture only",
        "source_url": "https://example.org/synthetic",
        "source_license": "Synthetic test data",
        "license_reviewed": True, "approved_for_display": True,
        "acquired_at": "2026-11-10T00:00:00Z",
        "attribution": "TSM synthetic test",
        "authority_class": "CONTEXT", "style": style,
        "crs": "EPSG:4326", "vertical_datum": None,
        "display_fields": ["name"],
    }


def fixture_root(tmp_path):
    root = tmp_path / "screen"
    root.mkdir()
    hazard = _write(root, "hazard", [
        _feature("Polygon", [[[-88.2, 37.7], [-87.9, 37.7],
                              [-87.9, 38.0], [-88.2, 38.0], [-88.2, 37.7]]]),
        _feature("Polygon", [[[-88.1, 37.8], [-87.8, 37.8],
                              [-87.8, 38.1], [-88.1, 38.1], [-88.1, 37.8]]]),
    ], "fill")
    assets = _write(root, "assets", [
        _feature("Point", [-88.05, 37.9]),
        _feature("Point", [-87.6, 37.9]),
        _feature("Point", [-88.0, 38.0]),
    ], "circle")
    (root / "layers.json").write_text(json.dumps({
        "schema": "tsm.offline-incident-layers.v1", "layers": [hazard, assets]}))
    return root


def test_intersection_counts_unique_assets_and_no_flood_metrics(tmp_path):
    root = fixture_root(tmp_path)
    result = screen_local_exposure("hazard", "assets", root=root)
    assert result["hazardFeatureCount"] == 2
    assert result["assetFeatureCount"] == 3
    assert result["assetFeaturesIntersecting"] == 2
    assert result["assetFeaturesNotIntersecting"] == 1
    assert result["estimatedFloodDepth"] is None
    assert result["estimatedDamage"] is None
    assert result["estimatedFloodProbability"] is None
    assert result["femaRegulatoryDetermination"] is False
    assert result["humanReviewRequired"] is True
    assert len(result["hazardSha256"]) == 64


def test_budget_and_layer_selection_are_bounded(tmp_path):
    root = fixture_root(tmp_path)
    with pytest.raises(ExposureScreeningError, match="pair budget"):
        screen_local_exposure("hazard", "assets", root=root, max_pairs=5)
    with pytest.raises(ExposureScreeningError, match="differ"):
        screen_local_exposure("hazard", "hazard", root=root)
    with pytest.raises(ExposureScreeningError, match="polygon"):
        screen_local_exposure("assets", "hazard", root=root)
    with pytest.raises(ExposureScreeningError, match="explicitly staged"):
        screen_local_exposure("unknown", "assets", root=root)


def test_tampered_hazard_cannot_enter_screening(tmp_path):
    root = fixture_root(tmp_path)
    (root / "hazard.geojson").write_text('{"type":"FeatureCollection","features":[]}')
    with pytest.raises(IncidentLayerError, match="SHA-256"):
        screen_local_exposure("hazard", "assets", root=root)


def test_no_automatic_geometry_repair(tmp_path):
    root = fixture_root(tmp_path)
    path = root / "hazard.geojson"
    data = json.loads(path.read_text())
    data["features"][0]["geometry"]["coordinates"] = [
        [[-88.2, 37.7], [-87.9, 38.0], [-87.9, 37.7],
         [-88.2, 38.0], [-88.2, 37.7]]
    ]
    raw = json.dumps(data).encode()
    path.write_bytes(raw)
    manifest_path = root / "layers.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["layers"][0]["sha256"] = hashlib.sha256(raw).hexdigest()
    manifest_path.write_text(json.dumps(manifest))
    with pytest.raises(ExposureScreeningError, match="invalid or empty"):
        screen_local_exposure("hazard", "assets", root=root)
