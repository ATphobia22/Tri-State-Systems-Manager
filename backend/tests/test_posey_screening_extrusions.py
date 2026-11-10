"""Unit tests: no false height, datum or LoD promotion from Posey candidates."""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path

import pytest

TARGET = Path(__file__).resolve().parents[2] / "scripts/geospatial/prepare_posey_screening_extrusions.py"
SPEC = importlib.util.spec_from_file_location("screening_extrusion", TARGET)
assert SPEC and SPEC.loader
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)

POLY = {
    "type": "Polygon",
    "coordinates": [[[-88.0, 37.85], [-87.999, 37.85],
                     [-87.999, 37.851], [-88.0, 37.851], [-88.0, 37.85]]],
}


def feature(objectid=1, height=7.0, source="OVERTURE_NEAREST_20M", geometry=POLY):
    return {
        "type": "Feature",
        "id": objectid,
        "properties": {
            "objectid": objectid,
            "height_m": height,
            "height_source": source,
            "address": "PRIVATE_SOURCE_ADDRESS_NOT_FOR_EXPORT",
            "ground_elevation_navd88_ft": 999.0,
            "heightProvenance": "OBSERVED",  # must not override source category
        },
        "geometry": geometry,
    }


def write_collection(tmp_path, items):
    path = tmp_path / "source.geojson"
    path.write_text(json.dumps({"type": "FeatureCollection", "features": items}), encoding="utf8")
    return path, hashlib.sha256(path.read_bytes()).hexdigest()


def test_estimated_height_is_safe_visual_prism_without_vertical_elevation():
    candidate = mod.visualize_candidate(feature())
    assert candidate["id"] == 1
    assert candidate["properties"]["tsm_visual_height_m"] == 7.0
    assert candidate["properties"]["tsm_visual_base_m"] == 0.0
    assert candidate["properties"]["tsm_height_evidence"] == "ESTIMATED_THIRD_PARTY"
    assert candidate["properties"]["tsm_geometry_lod"] == "LoD1_ESTIMATED"
    assert candidate["properties"]["tsm_vertical_datum"] == "NOT_VERIFIED"
    assert candidate["properties"]["tsm_engineering_approved"] is False
    assert "address" not in candidate["properties"]
    assert "ground_elevation_navd88_ft" not in candidate["properties"]


def test_rural_default_is_not_observed_roof():
    result = mod.visualize_candidate(feature(source="DEFAULT_RURAL_MEDIAN"))
    assert result["properties"]["tsm_height_evidence"] == "ESTIMATED_DEFAULT"
    assert result["properties"]["tsm_roof_geometry_observed"] is False


@pytest.mark.parametrize("height", [-1, 0, 301, float("inf"), float("nan"), "12", True, None])
def test_invalid_height_is_rejected(height):
    with pytest.raises(ValueError, match="HEIGHT"):
        mod.visualize_candidate(feature(height=height))


@pytest.mark.parametrize("source", ["OBSERVED", "DERIVED", "LIDAR", "SCENARIO", "", None])
def test_unapproved_height_source_never_enters_visual_layer(source):
    assert mod.visualize_candidate(feature(source=source)) is None


def test_invalid_geometry_is_excluded_not_repaired():
    bad = {"type": "Polygon", "coordinates": [
        [[0, 0], [1, 1], [0, 1], [1, 0], [0, 0]]
    ]}
    assert mod.visualize_candidate(feature(geometry=bad)) is None


def test_false_objectid_alias_blocked():
    f = feature()
    f["properties"]["OBJECTID"] = 2
    with pytest.raises(ValueError, match="CONFLICTING"):
        mod.visualize_candidate(f)


def test_mixed_sources_receipt_and_bounded_public_metadata(tmp_path):
    path, sha = write_collection(tmp_path, [
        feature(1),
        feature(2, source="DEFAULT_RURAL_MEDIAN"),
        feature(3, source="OBSERVED"),
    ])
    result, receipt = mod.prepare(path, sha, 3)
    assert len(result["features"]) == 2
    assert receipt["excluded_feature_count"] == 1
    assert receipt["classification_counts"]["ESTIMATED_DEFAULT"] == 1
    assert receipt["classification_counts"]["ESTIMATED_THIRD_PARTY"] == 1
    assert receipt["datum_verified"] is False
    assert receipt["engineering_approved"] is False
    assert "PRIVATE_SOURCE_ADDRESS" not in json.dumps(result)


def test_duplicate_source_id_rejected(tmp_path):
    path, sha = write_collection(tmp_path, [feature(1), feature(1)])
    with pytest.raises(ValueError, match="DUPLICATE"):
        mod.prepare(path, sha, 2)


def test_unverified_source_bytes_rejected(tmp_path):
    path, sha = write_collection(tmp_path, [feature()])
    with pytest.raises(ValueError, match="SOURCE_SHA256_MISMATCH"):
        mod.prepare(path, "0"*64, 1)
    with pytest.raises(ValueError, match="FEATURE_COUNT_MISMATCH"):
        mod.prepare(path, sha, 23082)


def test_atomic_receipt_and_output_sha(tmp_path):
    path, sha = write_collection(tmp_path, [feature()])
    result, receipt = mod.prepare(path, sha, 1)
    output = tmp_path / "visual.json"
    receipt["output_sha256"] = mod.atomic_json(output, result)
    mod.atomic_json(tmp_path / "receipt.json", receipt)
    assert hashlib.sha256(output.read_bytes()).hexdigest() == receipt["output_sha256"]
    assert json.loads(output.read_text())["features"][0]["properties"]["tsm_engineering_approved"] is False
