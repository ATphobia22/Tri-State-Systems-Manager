"""Exhaustive selectable-building representation tests without false geometry claims."""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import sys

import pytest

SCRIPTS = Path(__file__).resolve().parents[2] / "scripts/geospatial"
sys.path.insert(0, str(SCRIPTS))
import build_posey_clickable_lod1 as mod

POLYGON = {
    "type": "Polygon",
    "coordinates": [[[-88.0, 37.85], [-87.999, 37.85],
                     [-87.999, 37.851], [-88.0, 37.851], [-88.0, 37.85]]],
}
SELF_INTERSECTION = {
    "type": "Polygon",
    "coordinates": [[[-88.0, 37.85], [-87.999, 37.851],
                     [-88.0, 37.851], [-87.999, 37.85], [-88.0, 37.85]]],
}


def feature(oid: int, geometry=None, height_source="DEFAULT_RURAL_MEDIAN"):
    return {
        "type": "Feature", "id": oid,
        "geometry": geometry or POLYGON,
        "properties": {
            "objectid": oid, "height_m": 4.0, "height_source": height_source,
            "lidaryear": "2020",
            "address": "SENSITIVE_SOURCE_PROP_SHOULD_NOT_LEAK",
        },
    }


def input_snapshot(tmp_path, features):
    path = tmp_path / "source.geojson"
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf8")
    return path, hashlib.sha256(path.read_bytes()).hexdigest()


def test_all_buildings_retained_even_when_source_polygon_invalid(tmp_path):
    source, sha = input_snapshot(tmp_path, [feature(11), feature(12, SELF_INTERSECTION)])
    result, receipt = mod.generate(source, source_sha=sha, expected_count=2)
    assert len(result["features"]) == 2
    assert receipt["unique_objectids"] == 2
    assert receipt["visual_repairs_count"] == 1
    assert receipt["visual_repairs_objectids"] == [12]
    assert result["features"][1]["properties"]["tsm_geometry_status"] == "REPAIRED_VISUAL_ONLY"
    assert all(f["properties"]["tsm_engineering_approved"] is False for f in result["features"])
    assert all(f["properties"]["tsm_vertical_datum"] == "NOT_VERIFIED" for f in result["features"])
    assert "SENSITIVE_SOURCE_PROP_SHOULD_NOT_LEAK" not in json.dumps(result)


def test_optional_reviewed_address_record_is_never_fabricated(tmp_path):
    source, sha = input_snapshot(tmp_path, [feature(11)])
    table = {
        "type": "FeatureCollection",
        "tsm_match_schema": "tsm.reviewed-posey-address-match.v1",
        "features": [{"type": "Feature", "geometry": None, "properties": {
            "building_objectid": 11,
            "match_status": "ONE_POINT_WITHIN_BUILDING",
            "source_layer_url": mod.ADDRESS_SERVICE,
            "geofulladdress": "123 MAIN ST",
        }}],
    }
    matches = tmp_path / "matches.geojson"
    matches.write_text(json.dumps(table), encoding="utf8")
    result, receipt = mod.generate(source, source_sha=sha, expected_count=1, addresses_file=matches)
    p = result["features"][0]["properties"]
    assert p["tsm_address"] == "123 MAIN ST"
    assert p["tsm_address_status"] == "MATCHED_OFFICIAL_POINT"
    assert receipt["address_match_receipt_sha256"] == hashlib.sha256(matches.read_bytes()).hexdigest()


def test_unreviewed_address_not_used(tmp_path):
    source, sha = input_snapshot(tmp_path, [feature(11)])
    result, receipt = mod.generate(source, source_sha=sha, expected_count=1)
    assert result["features"][0]["properties"]["tsm_address"] == ""
    assert result["features"][0]["properties"]["tsm_address_status"] == "ADDRESS_NOT_VERIFIED"
    assert receipt["address_match_receipt_sha256"] is None


def test_duplicate_building_ids_rejected(tmp_path):
    source, sha = input_snapshot(tmp_path, [feature(11), feature(11)])
    with pytest.raises(ValueError, match="DUPLICATE_SOURCE_OBJECTID"):
        mod.generate(source, source_sha=sha, expected_count=2)


def test_source_hash_mismatch_rejected(tmp_path):
    source, sha = input_snapshot(tmp_path, [feature(11)])
    with pytest.raises(ValueError, match="SOURCE_SHA256_MISMATCH"):
        mod.generate(source, source_sha="0" * 64, expected_count=1)


def test_address_join_enforces_strict_containment_not_nearest():
    from match_posey_address_points import build_matches
    building = feature(17)
    inside = {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-87.9995, 37.8505]},
              "properties": {"objectid": 100, "county": "Posey County", "geofulladdress": "17 TEST RD"}}
    outside = {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-87.998, 37.8505]},
              "properties": {"objectid": 101, "county": "Posey County", "geofulladdress": "18 TEST RD"}}
    result, receipt = build_matches([building], [inside, outside], "0" * 64)
    props = result["features"][0]["properties"]
    assert props["match_status"] == "ONE_POINT_WITHIN_BUILDING"
    assert props["geofulladdress"] == "17 TEST RD"
    assert receipt["unmatched_and_ambiguous_are_not_fabricated"] is True


def test_multiple_address_points_remain_ambiguous():
    from match_posey_address_points import build_matches
    coords = [-87.9995, 37.8505]
    points = [
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": coords},
         "properties": {"objectid": number, "county": "Posey County", "geofulladdress": label}}
        for number, label in [(100, "17 TEST RD"), (101, "19 TEST RD")]
    ]
    result, _ = build_matches([feature(17)], points, "0" * 64)
    props = result["features"][0]["properties"]
    assert props["match_status"] == "MULTIPLE_POINTS_WITHIN_BUILDING"
    assert "geofulladdress" not in props
