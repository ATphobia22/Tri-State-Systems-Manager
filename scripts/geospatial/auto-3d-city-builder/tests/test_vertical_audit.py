import json
import subprocess
import sys
from pathlib import Path
import pytest
from citybuilder.vertical_bridge import prepare, GEO
from citybuilder.tsm_adapter import sha
from citybuilder.vertical_audit import verify
from test_vertical_bridge import fixture

def artifact(tmp_path):
    source, data = fixture(tmp_path)
    root = source.parent
    scene_raw = (source/"scene.json").read_bytes()
    fc, report = prepare(json.loads(scene_raw),data,lambda lon,lat:-30.0)
    lidar = root/"lidar.geojson"
    lidar.write_text(json.dumps(data))
    meta = root/"copc-receipt.json"
    meta.write_text("{}")
    candidate = root/"candidate"
    candidate.mkdir()
    geojson = candidate/"source-bound-height-candidates.geojson"
    geojson.write_text(json.dumps(fc))
    tiles = candidate/"tiles"
    subprocess.run([sys.executable,str(GEO/"build-building-3d-tiles.py"),
        "--geojson",str(geojson),"--out-dir",str(tiles),
        "--expected-buildings","1","--require-geoid-placement"],check=True)
    report.update(scene_sha256=sha(scene_raw),lidar_sha256=sha(lidar.read_bytes()),
        source_metadata_sha256=sha(meta.read_bytes()),source_evidence_kind="COPC_HEADER_EPSG_2968_6360",
        candidate_geojson_sha256=sha(geojson.read_bytes()),
        tileset_sha256=sha((tiles/"tileset.json").read_bytes()),
        status="NOMINAL_PLACEMENT_CANDIDATE_BUILT")
    (candidate/"vertical-reconstruction-receipt.json").write_text(json.dumps(report))
    return root

def test_real_tiler_artifact_integrity_is_not_production_acceptance(tmp_path):
    result=verify(artifact(tmp_path))
    assert result["source_count"]==1
    assert result["candidate_count"]==1
    assert result["complete_candidate_coverage"] is True
    assert result["publication_eligible"] is False
    assert result["terrain_checkpoints"]=="NOT_VALIDATED"

def test_tampered_glb_rejected(tmp_path):
    root=artifact(tmp_path)
    (root/"candidate/tiles/1.glb").write_bytes(b"glTF")
    with pytest.raises(ValueError,match="digest"):
        verify(root)

def test_missing_identity_rejected(tmp_path):
    root=artifact(tmp_path)
    path=root/"candidate/vertical-reconstruction-receipt.json"
    report=json.loads(path.read_text())
    report["unavailable_ids"]=["IGIO:building:1"]
    path.write_text(json.dumps(report))
    with pytest.raises(ValueError,match="identity"):
        verify(root)

def test_candidate_cannot_claim_publication(tmp_path):
    root=artifact(tmp_path)
    path=root/"candidate/vertical-reconstruction-receipt.json"
    report=json.loads(path.read_text())
    report["publication_eligible"]=True
    path.write_text(json.dumps(report))
    with pytest.raises(ValueError,match="authority"):
        verify(root)
