"""Synthetic byte-for-byte tests for bounded IGIO raster chunk transfer."""
import hashlib
import importlib.util
import json
from pathlib import Path

import pytest

PATH=Path(__file__).resolve().parents[2]/"scripts/geospatial/chunk_igio_tiff_for_drive.py"
spec=importlib.util.spec_from_file_location("chunk_igio",PATH)
assert spec and spec.loader
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def make_test_inputs(tmp_path, image:bytes):
    root=tmp_path/"in2025-18129"
    (root/"imagery2025").mkdir(parents=True)
    (root/"dsm2025").mkdir()
    p=root/"imagery2025"/"test.tif"
    d=root/"dsm2025"/"test.tif"
    p.write_bytes(image)
    d.write_bytes(b"II*\x00demo")
    (root/"imagery2025-posey-manifest.csv").write_text("url_tif\n")
    (root/"dsm2025-posey-manifest.csv").write_text("url_dsm\n")
    r={"county":"Posey","county_fips":"18129","downloaded_objects":[
       {"role":"imagery2025","file":str(p),"sha256":hashlib.sha256(p.read_bytes()).hexdigest(),"bytes":p.stat().st_size},
       {"role":"dsm2025","file":str(d),"sha256":hashlib.sha256(d.read_bytes()).hexdigest(),"bytes":d.stat().st_size}
    ]}
    (root/"acquisition-receipt.json").write_text(json.dumps(r))
    return root


def test_split_two_chunks_preserves_original_bytes_and_metadata(tmp_path):
    body=b"II*\x00ABCDEFGHI"
    root=make_test_inputs(tmp_path,body)
    staging=tmp_path/"staging"
    receipt=m.stage(root,staging,chunk_bytes=7)
    assert len(receipt["image_parts"])==2
    assert [x["bytes"] for x in receipt["image_parts"]]==[7,6]
    assert (staging/"metadata"/"dsm2025"/"test.tif").read_bytes()==b"II*\x00demo"
    assert not (staging/"metadata"/"imagery2025"/"test.tif").exists()
    rebuilt=b"".join((staging/x["relative_path"]).read_bytes() for x in receipt["image_parts"])
    assert rebuilt==body
    assert hashlib.sha256(rebuilt).hexdigest()==receipt["original_image_sha256"]
    assert receipt["original_image_bytes"]==len(body)
    assert receipt["original_county_fips"]=="18129"


def test_refuse_more_than_two_parts(tmp_path):
    root=make_test_inputs(tmp_path,b"II*\x00ABCDEFGHIJKLMN")
    with pytest.raises(ValueError,match="CHUNK_BUDGET"):
        m.stage(root,tmp_path/"stage",chunk_bytes=7)


def test_refuse_imagery_hash_mismatch(tmp_path):
    root=make_test_inputs(tmp_path,b"II*\x00ABC")
    (root/"imagery2025"/"test.tif").write_bytes(b"II*\x00ABZ")
    with pytest.raises(ValueError,match="ORIGINAL_SHA256_MISMATCH"):
        m.stage(root,tmp_path/"stage",chunk_bytes=5)


def test_reject_missing_raster_receipt(tmp_path):
    root=make_test_inputs(tmp_path,b"II*\x00ABC")
    (root/"acquisition-receipt.json").unlink()
    with pytest.raises(ValueError,match="SOURCE_RECEIPT_MISSING"):
        m.stage(root,tmp_path/"stage",chunk_bytes=5)
