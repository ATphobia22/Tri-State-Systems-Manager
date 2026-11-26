import json
from pathlib import Path
import pytest
from citybuilder.cli import build

SAMPLE=Path(__file__).parents[1]/"examples"/"sample_footprints_32616.geojson"

def test_produces_glb_tileset_and_digest(tmp_path):
    m=build(SAMPLE,tmp_path/"out","EPSG:32616","m","DEMO_NAVD88_UNVALIDATED","m")
    assert m["features_built"]==2
    assert (tmp_path/"out"/"buildings.glb").read_bytes()[:4]==b"glTF"
    t=json.loads((tmp_path/"out"/"tileset.json").read_text())
    assert t["asset"]["version"]=="1.1"
    assert len(t["root"]["transform"])==16
    assert "NO geoid shift" in m["globe_anchor"]

def test_rejects_geographic_crs(tmp_path):
    with pytest.raises(ValueError,match="projected"):
        build(SAMPLE,tmp_path/"out","EPSG:4326","m","NAVD88","m")

def test_rejects_missing_heights(tmp_path):
    data=json.loads(SAMPLE.read_text())
    del data["features"][0]["properties"]["height_m"]
    p=tmp_path/"missing.geojson"
    p.write_text(json.dumps(data))
    with pytest.raises(ValueError,match="invalid features"):
        build(p,tmp_path/"out","EPSG:32616","m","NAVD88","m")

def test_rejects_unnamed_datum(tmp_path):
    with pytest.raises(ValueError,match="datum"):
        build(SAMPLE,tmp_path/"out","EPSG:32616","m","unknown","m")
