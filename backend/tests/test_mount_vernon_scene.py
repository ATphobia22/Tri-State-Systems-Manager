"""Offline, synthetic-contract tests; NOT evidence of a completed government download."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
PATH = ROOT / "scripts" / "geospatial" / "build_mount_vernon_scene.py"
SPEC = importlib.util.spec_from_file_location("tsm_mount_vernon_scene", PATH)
assert SPEC is not None and SPEC.loader is not None
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


def feature(oid: int, kind: str) -> dict:
    geo = ({"type": "Polygon", "coordinates": [[[-87.9, 37.9], [-87.89, 37.9], [-87.89, 37.91], [-87.9, 37.9]]]}
           if kind == "building" else
           {"type": "LineString", "coordinates": [[-87.9, 37.9], [-87.89, 37.91]]})
    return {"type": "Feature", "properties": {"objectid": oid, "st_name": "Synthetic road"},
            "geometry": geo}


def test_bbox_rejects_nonfinite_and_unbounded():
    for bounds in [(float("nan"), 37.9, -87.9, 38.0), (-90, 37, -87, 39)]:
        with pytest.raises(ValueError):
            module.valid_bbox(bounds)


def test_building_identity_and_provenance_without_synthetic_roof(monkeypatch):
    calls = []
    def fake_query(url, params):
        calls.append(params)
        if params.get("returnIdsOnly") == "true":
            return {"objectIds": [1, 2]}, "a" * 64
        return {"type": "FeatureCollection", "features": [feature(1, "building"), feature(2, "building")]}, "b" * 64
    monkeypatch.setattr(module, "query", fake_query)
    features, evidence = module.collect_layer("building", module.BUILDINGS, module.DEFAULT_BBOX)
    assert [x["properties"]["tsm_id"] for x in features] == ["IGIO:building:1", "IGIO:building:2"]
    assert all(x["properties"]["height_m"] is None for x in features)
    assert all(x["properties"]["engineering_approved"] is False for x in features)
    assert len(evidence["raw_response_sha256"]) == 2
    assert calls[1]["outSR"] == 4326


def test_missing_source_feature_fails_entire_batch(monkeypatch):
    def fake_query(url, params):
        if params.get("returnIdsOnly") == "true":
            return {"objectIds": [1, 2]}, "a" * 64
        return {"type": "FeatureCollection", "features": [feature(1, "building")]}, "b" * 64
    monkeypatch.setattr(module, "query", fake_query)
    with pytest.raises(ValueError, match="INCOMPLETE"):
        module.collect_layer("building", module.BUILDINGS, module.DEFAULT_BBOX)


def test_receipt_binds_exact_archive_bytes(tmp_path):
    source = ([], {"agency": "IGIO"})
    scene = module.build_scene(module.DEFAULT_BBOX, source, source)
    path, receipt_path = module.write_scene(scene, tmp_path)
    receipt = json.loads(receipt_path.read_bytes())
    assert module.digest(path.read_bytes()) == receipt["sha256"]
    assert receipt["regulatory_approval"] is False
    assert scene["vertical_datum"] == "NOT_ESTABLISHED_FOR_GEOMETRY"


def test_invalid_geometry_rejected():
    assert not module.valid_geometry({"type": "Polygon", "coordinates": [[[-87.9, float("inf")]]]}, "building")
    assert not module.valid_geometry({"type": "LineString", "coordinates": [[2e3, 37.0]]}, "road")
