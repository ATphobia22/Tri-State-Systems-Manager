"""Synthetic offline tests for Mount Vernon viewer packaging evidence.

These tests are intentionally not claims of an actual government archive or native build.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
PATH = ROOT / "scripts/geospatial/verify_mount_vernon_deployment.py"
spec = importlib.util.spec_from_file_location("tsm_city_deploy", PATH)
assert spec and spec.loader
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def prepare(root: Path) -> Path:
    assets = root / "assets"
    assets.mkdir(parents=True)
    (assets / "main.js").write_text("console.log('synthetic city viewer');", encoding="utf-8")
    (root / "index.html").write_text("<!doctype html><title>City test</title>", encoding="utf-8")
    city = root / "mount-vernon-scene"
    city.mkdir()
    source = {
        "buildings": m.BUILDINGS, "roads": m.ROADS,
    }
    groups = {}
    sources = {}
    for layer, kind, geom in [
        ("buildings", "building", {"type": "Polygon", "coordinates": [[[-87.91, 37.92], [-87.9, 37.92], [-87.91, 37.92]]]}),
        ("roads", "road", {"type": "LineString", "coordinates": [[-87.91, 37.92], [-87.90, 37.93]]}),
    ]:
        ident = f"IGIO:{kind}:1"
        groups[layer] = {"type": "FeatureCollection", "features": [{
            "type": "Feature", "id": ident, "geometry": geom,
            "properties": {"source_objectid": 1, "tsm_id": ident, "source_url": source[layer],
                           "source_feature_sha256": "a" * 64, "kind": kind,
                           "height_m": None, "height_status": "NOT_EVIDENCED",
                           "evidence_status": "SOURCE_OBSERVED_UNREVIEWED",
                           "engineering_approved": False},
        }]}
        sources[layer] = {"layer_url": source[layer], "output_crs": "EPSG:4326", "source_object_count": 1}
    scene = {
        "schema": "tsm.mount-vernon-city-scene.v1",
        "accuracy_claim": "REFERENCE_ONLY_NOT_SURVEY_OR_ENGINEERING",
        "crs": "EPSG:4326", "vertical_datum": "NOT_ESTABLISHED_FOR_GEOMETRY",
        "terrain": {"height_datum": "MUST_BE_VERIFIED_SEPARATELY"},
        "sources": sources, **groups,
    }
    raw = json.dumps(scene, sort_keys=True).encode()
    (city / "scene.json").write_bytes(raw)
    (city / "scene.receipt.json").write_text(json.dumps({
        "schema": "tsm.mount-vernon-city-receipt.v1",
        "sha256": hashlib.sha256(raw).hexdigest(),
        "byte_length": len(raw),
        "feature_counts": {"buildings": 1, "roads": 1},
        "review": "NOT_EVIDENCED", "regulatory_approval": False,
    }))
    return root


def test_manifest_reproducible_and_verifies(tmp_path):
    root = prepare(tmp_path)
    expected = m.assemble(root)
    (root / m.MANIFEST_NAME).write_text(json.dumps(expected))
    assert m.verify_manifest(root) == expected
    assert expected["native_windows_shipping_verified"] is False
    assert expected["terrain_vertical_datum_verified"] is False
    assert len(expected["files"]) == 4


def test_viewer_asset_tamper_rejected(tmp_path):
    root = prepare(tmp_path)
    (root / m.MANIFEST_NAME).write_text(json.dumps(m.assemble(root)))
    (root / "assets/main.js").write_text("tampered")
    with pytest.raises(ValueError, match="MANIFEST_MISMATCH"):
        m.verify_manifest(root)


def test_scene_receipt_tamper_rejected(tmp_path):
    root = prepare(tmp_path)
    (root / "mount-vernon-scene/scene.json").write_bytes(b"{}")
    with pytest.raises(ValueError, match="HASH_MISMATCH"):
        m.assemble(root)


def test_building_height_cannot_be_promoted_to_measured(tmp_path):
    root = prepare(tmp_path)
    city = root / "mount-vernon-scene"
    scene = json.loads((city / "scene.json").read_text())
    scene["buildings"]["features"][0]["properties"]["height_m"] = 12.0
    raw = json.dumps(scene).encode()
    (city / "scene.json").write_bytes(raw)
    receipt = json.loads((city / "scene.receipt.json").read_text())
    receipt.update(sha256=hashlib.sha256(raw).hexdigest(), byte_length=len(raw))
    (city / "scene.receipt.json").write_text(json.dumps(receipt))
    with pytest.raises(ValueError, match="UNSUPPORTED_ENGINEERING_PROPERTY"):
        m.assemble(root)


def test_missing_build_asset_rejected(tmp_path):
    root = prepare(tmp_path)
    (root / "assets/main.js").unlink()
    with pytest.raises(ValueError, match="VIEWER_JAVASCRIPT_MISSING"):
        m.assemble(root)


def test_symlink_in_distribution_rejected(tmp_path):
    root = prepare(tmp_path)
    external = tmp_path.parent / ("external_" + tmp_path.name)
    external.write_text("outside")
    (root / "assets/linked.txt").symlink_to(external)
    with pytest.raises(ValueError, match="SYMLINK"):
        m.assemble(root)
    external.unlink()
