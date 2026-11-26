import json
import hashlib
from pathlib import Path
import pytest
from citybuilder.vertical_bridge import prepare
from test_tsm_adapter import scene_fixture

def fixture(tmp_path):
    source = scene_fixture(tmp_path/"source")
    scene = json.loads((source/"scene.json").read_text())
    f = scene["buildings"]["features"][0]
    f["properties"].update({"lidarHeightStatus":"OK","lidarHeightDatum":"NAVD88","lidarHeightUnit":"ftUS",
        "lidarGroundElevM":120.0,"lidarRoofElevM":128.0,"lidarHeightM":8.0,
        "lidarRoofPoints":10,"lidarGroundPoints":5,"lidarHeightMethod":"test fixture",
        "lidarSource":"https://example.invalid/ept.json"})
    return source, {"type":"FeatureCollection","features":[f]}

def test_accepts_bound_height_and_applies_signed_geoid(tmp_path):
    source, data = fixture(tmp_path)
    fc, report = prepare(json.loads((source/"scene.json").read_text()), data, lambda lon,lat:-30.0)
    props = fc["features"][0]["properties"]
    assert props["lidarHeightFt"] == pytest.approx(8*3937/1200)
    assert props["groundElevationFt"] == pytest.approx(120*3937/1200)
    assert props["geoidUndulationM"] == -30
    assert report["accepted_count"] == 1
    assert report["engineering_eligible"] is False

def test_missing_height_is_never_filled(tmp_path):
    source, data = fixture(tmp_path)
    data["features"][0]["properties"]["lidarHeightStatus"] = "unavailable"
    fc, report = prepare(json.loads((source/"scene.json").read_text()), data, lambda lon,lat:-30.0)
    assert fc["features"] == []
    assert report["unavailable_ids"] == ["IGIO:building:1"]

def test_wrong_source_geometry_rejected(tmp_path):
    source, data = fixture(tmp_path)
    data["features"][0]["geometry"]["coordinates"][0][0][0] += .01
    with pytest.raises(ValueError, match="geometry"):
        prepare(json.loads((source/"scene.json").read_text()), data, lambda lon,lat:-30.0)

def test_wrong_datum_rejected(tmp_path):
    source, data = fixture(tmp_path)
    data["features"][0]["properties"]["lidarHeightDatum"] = "UNKNOWN"
    fc, report = prepare(json.loads((source/"scene.json").read_text()), data, lambda lon,lat:-30.0)
    assert not fc["features"]
    assert report["unavailable_ids"] == ["IGIO:building:1"]
