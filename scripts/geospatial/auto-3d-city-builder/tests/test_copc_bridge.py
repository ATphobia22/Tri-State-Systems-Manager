import hashlib
import json
from pathlib import Path
import pytest
from citybuilder.vertical_bridge import validate_copc_sources
from test_vertical_bridge import fixture

def test_copc_rejects_unbound_input_before_header(tmp_path):
    pytest.importorskip("laspy")
    source,data=fixture(tmp_path)
    scene=json.loads((source/"scene.json").read_text())
    with pytest.raises(ValueError,match="input digest"):
        validate_copc_sources(data,{"inputSha256":"0"*64},tmp_path,"a"*64,scene)

def test_copc_rejects_missing_raw_tile(tmp_path):
    pytest.importorskip("laspy")
    source,data=fixture(tmp_path)
    scene=json.loads((source/"scene.json").read_text())
    url="https://giselevationingov.s3.amazonaws.com/copc/statewide/2020/SPW/ql2/IN2020_26700930_12.copc.laz"
    data["features"][0]["properties"].update(heightProvenance="DERIVED",lidarSource=url,lidarSourceTiles=[{"url":url,"sha256":"a"*64}])
    receipt={"inputSha256":hashlib.sha256(json.dumps(scene["buildings"]).encode()).hexdigest(),"outputSha256":"b"*64}
    with pytest.raises(ValueError,match="Missing raw"):
        validate_copc_sources(data,receipt,tmp_path,"b"*64,scene)
