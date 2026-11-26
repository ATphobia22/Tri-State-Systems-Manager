import json
from pathlib import Path
import pytest
from citybuilder.tsm_adapter import reconstruct
from citybuilder.candidate_gate import verify
from test_tsm_adapter import scene_fixture

def test_candidate_gate_checks_real_generated_bytes(tmp_path):
    source = scene_fixture(tmp_path/"scene")
    out = tmp_path/"candidate"
    reconstruct(source, out, estimate_missing=True)
    report = verify(source, out)
    assert report["status"] == "VISUAL_CANDIDATE_INTEGRITY_PASS"
    assert report["publication_eligible"] is False
    assert report["feature_count"] == 1

def test_candidate_gate_rejects_tampered_glb(tmp_path):
    source = scene_fixture(tmp_path/"scene")
    out = tmp_path/"candidate"
    reconstruct(source, out, estimate_missing=True)
    (out/"buildings.glb").write_bytes(b"glTF")
    with pytest.raises(ValueError, match="digest"):
        verify(source, out)

def test_candidate_gate_rejects_changed_identity(tmp_path):
    source = scene_fixture(tmp_path/"scene")
    out = tmp_path/"candidate"
    reconstruct(source, out, estimate_missing=True)
    p = out/"tsm-reconstruction-receipt.json"
    r = json.loads(p.read_text())
    r["source_ids"] = ["IGIO:building:999"]
    p.write_text(json.dumps(r))
    with pytest.raises(ValueError, match="identity"):
        verify(source, out)

def test_candidate_gate_rejects_publication_flag(tmp_path):
    source = scene_fixture(tmp_path/"scene")
    out = tmp_path/"candidate"
    reconstruct(source, out, estimate_missing=True)
    p = out/"tsm-reconstruction-receipt.json"
    r = json.loads(p.read_text())
    r["publication_eligible"] = True
    p.write_text(json.dumps(r))
    with pytest.raises(ValueError, match="authority"):
        verify(source, out)
