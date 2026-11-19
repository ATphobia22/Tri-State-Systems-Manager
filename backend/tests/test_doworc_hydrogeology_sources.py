"""Bounded source archive downloader tests without network access."""
import importlib.util
import io
import pathlib
import zipfile
import pytest

path = pathlib.Path(__file__).resolve().parents[2] / "scripts/geo/acquire_doworc_hydrogeology_sources.py"
spec = importlib.util.spec_from_file_location("doworc_acquire", path)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

def make_zip(path, entry="county/aquifer.shp", contents=b"placeholder"):
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr(entry, contents)

def test_allowlisted_public_authority_rejects_offhost_and_plain_http():
    assert m.validate_url("https://www.in.gov/dA/0d660373d7/example.zip")
    for url in ("http://www.in.gov/example.zip", "https://evil.example/zip.zip",
                "https://www.in.gov.evil.example/zip.zip", "https://user:pass@www.in.gov/data.zip"):
        with pytest.raises(ValueError,match="SOURCE_HOST"):
            m.validate_url(url)

def test_real_crc_and_shapefile_member(tmp_path):
    target = tmp_path / "source.zip"
    make_zip(target)
    result = m.verify_shapefile_zip(target)
    assert result["zipEntryCount"] == 1
    assert result["shapefiles"] == ["county/aquifer.shp"]

def test_reject_zip_without_shapefiles(tmp_path):
    target = tmp_path / "source.zip"
    make_zip(target, "readme.txt")
    with pytest.raises(ValueError,match="NO_SHAPEFILE"):
        m.verify_shapefile_zip(target)

def test_reject_zip_with_traversal_path(tmp_path):
    target = tmp_path / "source.zip"
    make_zip(target, "../escape.shp")
    with pytest.raises(ValueError,match="TRAVERSAL"):
        m.verify_shapefile_zip(target)

def test_verified_county_catalog_has_eight_unique_download_urls():
    import json
    data = json.loads(m.CATALOG.read_text())
    items = data["datasets"]
    assert len(items) == 8
    assert {item["county"] for item in items} == {"Posey", "Gibson", "Vanderburgh", "Warrick"}
    assert {item["kind"] for item in items} == {"aquifer_system", "potentiometric"}
    assert len({item["url"] for item in items}) == 8
    assert all(m.validate_url(item["url"]) for item in items)
