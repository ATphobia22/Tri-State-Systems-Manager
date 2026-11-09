"""GDAL transform boundary tests without invoking installed GDAL or network."""
from __future__ import annotations

import hashlib
import json
import runpy
import shutil
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "packages/government/scripts/transform_geojson_gdal.py"
env = runpy.run_path(str(SCRIPT))
transform = env["transform"]


def fixture(tmp: Path, **changes):
    geo = {"type": "FeatureCollection", "features": []}
    raw = json.dumps(geo).encode()
    infile = tmp / "in.geojson"
    infile.write_bytes(raw)
    manifest = {
        "datasetId": "fixture", "sourceId": "fema-nfhl",
        "horizontalCrs": "EPSG:2966", "verticalDatum": "NAVD88",
        "sourceVersion": "fixture", "sha256": hashlib.sha256(raw).hexdigest(),
        "byteLength": len(raw), "validationStatus": "PASS",
    }
    manifest.update(changes)
    meta = tmp / "in.manifest.json"
    meta.write_text(json.dumps(manifest))
    return infile, meta, tmp / "out.geojson"


def test_bounded_gdal_command_and_unverified_output(monkeypatch, tmp_path):
    infile, meta, out = fixture(tmp_path)
    commands = []

    def fake_run(args, **kw):
        commands.append(args)
        shutil.copyfile(infile, out)

    monkeypatch.setitem(transform.__globals__, "subprocess", type("Fake", (), {"run": fake_run}))
    result = transform(str(infile), str(meta), str(out), ogr2ogr="/usr/bin/ogr2ogr")
    m = json.loads((tmp_path / "out.geojson.manifest.json").read_text())
    assert commands[0][commands[0].index("-s_srs") + 1] == "EPSG:2966"
    assert commands[0][commands[0].index("-t_srs") + 1] == "EPSG:4326"
    assert m["validationStatus"] == "UNVERIFIED"
    assert m["derivedFromSha256"] != "" and m["horizontalCrs"] == "EPSG:4326"
    assert result["sha256"] == hashlib.sha256(out.read_bytes()).hexdigest()


@pytest.mark.parametrize("name,value,diagnostic", [
    ("sha256", "0"*64, "EVIDENCE_HASH"),
    ("horizontalCrs", None, "EXPLICIT_SOURCE_EPSG"),
    ("horizontalCrs", "EPSG:4326;DROP TABLE", "EXPLICIT_SOURCE_EPSG"),
])
def test_refuses_unverified_input_metadata(tmp_path, name, value, diagnostic):
    infile, meta, out = fixture(tmp_path, **{name: value})
    with pytest.raises(ValueError, match=diagnostic):
        transform(str(infile), str(meta), str(out), ogr2ogr="/usr/bin/ogr2ogr")
