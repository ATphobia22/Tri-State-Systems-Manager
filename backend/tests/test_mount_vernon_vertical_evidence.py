"""Fail-closed synthetic tests: no real lidar, surveyed roof, or datum certified."""
from __future__ import annotations

import copy
import importlib.util
from pathlib import Path

import pytest

PATH = Path(__file__).resolve().parents[2] / "scripts/geospatial/reconcile_mount_vernon_vertical_evidence.py"
spec = importlib.util.spec_from_file_location("tsm_vertical", PATH)
assert spec and spec.loader
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def fixture():
    return {
        "schema": m.SCHEMA, "ground_vertical_datum": "NAVD88",
        "ground_height_type": "ORTHOMETRIC", "ground_units": "ftUS",
        "roof_height_type": "ABOVE_GROUND", "roof_units": "m",
        "ground_dataset_sha256": "a" * 64,
        "ground_datum_metadata_sha256": "b" * 64,
        "roof_source_sha256": "c" * 64,
        "records": [{
            "tsm_id": "IGIO:building:42", "source_feature_sha256": "d" * 64,
            "ground_elevation": 393.7, "roof_height_agl": 10.0,
            "ground_sample_method": "GROUND_CLASSIFIED_POINT_MEDIAN",
            "roof_height_method": "CLASSIFIED_ROOF_POINT_MEDIAN",
            "ground_sample_count": 10, "roof_sample_count": 15,
        }],
    }


def test_navd88_ftus_to_m_and_relative_height():
    r = m.reconcile(fixture())
    record = r["records"][0]
    assert record["ground_elevation_navd88_m"] == pytest.approx(120.0)
    assert record["roof_elevation_navd88_m"] == pytest.approx(130.0)
    assert record["engineering_approved"] is False
    assert r["validation_status"] == "DERIVED_UNREVIEWED"


@pytest.mark.parametrize("key,value,error", [
    ("ground_vertical_datum", None, "GROUND_DATUM"),
    ("ground_vertical_datum", "NGVD29", "GROUND_DATUM"),
    ("ground_vertical_datum", "ELLIPSOIDAL", "GROUND_DATUM"),
    ("ground_height_type", "ELLIPSOIDAL", "GROUND_HEIGHT"),
    ("ground_units", None, "VERTICAL_UNITS"),
    ("roof_units", "feet", "VERTICAL_UNITS"),
    ("roof_height_type", "ABSOLUTE", "ROOF_HEIGHT_MUST"),
    ("ground_datum_metadata_sha256", None, "INVALID_SHA256"),
])
def test_missing_or_unsupported_metadata_fails(key, value, error):
    data = fixture()
    data[key] = value
    with pytest.raises(ValueError, match=error):
        m.reconcile(data)


@pytest.mark.parametrize("key,value,error", [
    ("roof_height_agl", None, "INVALID_NUMERIC"),
    ("roof_height_agl", 0, "IMPLAUSIBLE"),
    ("roof_height_agl", 9_000, "IMPLAUSIBLE"),
    ("ground_elevation", float("nan"), "NONFINITE"),
    ("roof_sample_count", 0, "INVALID_SAMPLE_COUNT"),
    ("ground_sample_method", "GUESS_FROM_FLOORS", "UNSUPPORTED_SAMPLING"),
    ("roof_height_method", "DEFAULT_9M", "UNSUPPORTED_SAMPLING"),
    ("source_feature_sha256", "missing", "INVALID_SHA256"),
])
def test_invalid_evidence_fails(key, value, error):
    data = fixture()
    data["records"][0][key] = value
    with pytest.raises(ValueError, match=error):
        m.reconcile(data)


def test_duplicate_objectids_fail():
    data = fixture()
    data["records"].append(copy.deepcopy(data["records"][0]))
    with pytest.raises(ValueError, match="DUPLICATE"):
        m.reconcile(data)


def test_scene_source_identity_and_hash_required():
    data = fixture()
    scene = {"schema": "tsm.mount-vernon-city-scene.v1",
             "buildings": {"type": "FeatureCollection", "features": [{
                 "type": "Feature", "id": "IGIO:building:42",
                 "properties": {"tsm_id": "IGIO:building:42",
                                "source_feature_sha256": "d" * 64},
             }]}}
    m.validate_scene_bindings(data, scene)
    data["records"][0]["source_feature_sha256"] = "e" * 64
    with pytest.raises(ValueError, match="SCENE_SOURCE_ID_OR_HASH_MISMATCH"):
        m.validate_scene_bindings(data, scene)


def test_scene_missing_building_id_rejected():
    data = fixture()
    scene = {"schema": "tsm.mount-vernon-city-scene.v1",
             "buildings": {"type": "FeatureCollection", "features": []}}
    with pytest.raises(ValueError, match="SCENE_SOURCE_ID_OR_HASH_MISMATCH"):
        m.validate_scene_bindings(data, scene)
