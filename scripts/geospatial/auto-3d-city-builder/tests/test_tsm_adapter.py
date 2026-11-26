import hashlib
import json
from pathlib import Path

import pytest

from citybuilder.tsm_adapter import reconstruct

def scene_fixture(root):
    root.mkdir()
    feature = {"type": "Feature", "id": "IGIO:building:1",
        "geometry": {"type": "Polygon", "coordinates": [[[-87.9,37.93],[-87.8999,37.93],[-87.8999,37.9301],[-87.9,37.9301],[-87.9,37.93]]]},
        "properties": {"tsm_id": "IGIO:building:1", "source_feature_sha256": "a"*64,
                       "height_m": None, "height_status": "NOT_EVIDENCED", "engineering_approved": False}}
    scene = {"schema": "tsm.mount-vernon-city-scene.v1", "crs": "EPSG:4326",
        "sources": {"buildings": {"layer_url": "https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0", "output_crs": "EPSG:4326", "source_object_count": 1}},
        "buildings": {"type": "FeatureCollection", "features": [feature]},
        "roads": {"type": "FeatureCollection", "features": []}}
    raw = json.dumps(scene).encode()
    (root/"scene.json").write_bytes(raw)
    (root/"scene.receipt.json").write_text(json.dumps({"schema": "tsm.mount-vernon-city-receipt.v1",
        "scene_path": "./scene.json", "sha256": hashlib.sha256(raw).hexdigest(), "byte_length": len(raw),
        "feature_counts": {"buildings": 1, "roads": 0}, "regulatory_approval": False}))
    return root

def test_reconstruction_preserves_identity_and_quarantines_visual_estimates(tmp_path):
    source = scene_fixture(tmp_path/"scene")
    out = tmp_path/"candidate"
    report = reconstruct(source, out, estimate_missing=True)
    assert report["engineering_eligible"] is False
    assert report["publication_eligible"] is False
    assert report["terrain_alignment"] == "NOT_VALIDATED"
    assert report["input_scene_sha256"] == hashlib.sha256((source/"scene.json").read_bytes()).hexdigest()
    manifest = json.loads((out/"manifest.json").read_text())
    assert manifest["objects"][0]["source_id"] == "IGIO:building:1"
    assert manifest["input_crs"] == "EPSG:26916"
    assert manifest["objects"][0]["height_evidence"].startswith("ESTIMATED")
    assert (out/"buildings.glb").read_bytes()[:4] == b"glTF"
    for name, digest in report["output_sha256"].items():
        assert hashlib.sha256((out/name).read_bytes()).hexdigest() == digest
    assert not (out/"index.html").exists()

def test_tampered_source_rejected_before_output(tmp_path):
    source = scene_fixture(tmp_path/"scene")
    (source/"scene.json").write_bytes(b"{}")
    out = tmp_path/"candidate"
    with pytest.raises(ValueError, match="integrity"):
        reconstruct(source, out, estimate_missing=True)
    assert not out.exists()

def test_estimates_require_explicit_opt_in(tmp_path):
    source = scene_fixture(tmp_path/"scene")
    out = tmp_path/"candidate"
    with pytest.raises(ValueError):
        reconstruct(source, out)
    assert not out.exists()

def test_never_overwrites_existing_candidate(tmp_path):
    source = scene_fixture(tmp_path/"scene")
    out = tmp_path/"candidate"
    out.mkdir()
    marker = out/"marker"
    marker.write_text("keep")
    with pytest.raises(ValueError, match="exists"):
        reconstruct(source, out, estimate_missing=True)
    assert marker.read_text() == "keep"
