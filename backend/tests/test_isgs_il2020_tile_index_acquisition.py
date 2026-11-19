"""Synthetic tests for bounded ISGS 2020 White/Gallatin LiDAR source indexes."""
import hashlib
import io
import importlib.util
import zipfile
from pathlib import Path
from unittest.mock import patch

import pytest

PATH=Path(__file__).resolve().parents[2]/"scripts/geo/acquire_isgs_2020_tile_indexes.py"
spec=importlib.util.spec_from_file_location("isgs_indexes",PATH)
assert spec and spec.loader
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def fixture_index_zip():
    shapefile=pytest.importorskip("shapefile")
    pyproj=pytest.importorskip("pyproj")
    io_buffers=[io.BytesIO() for _ in range(3)]
    with shapefile.Writer(shp=io_buffers[0],shx=io_buffers[1],dbf=io_buffers[2],shapeType=shapefile.POLYGON) as s:
        s.field("TILE","C",size=12)
        s.poly([[[-88.2,37.6],[-88.2,37.7],[-88.1,37.7],[-88.1,37.6],[-88.2,37.6]]])
        s.record("tile-01")
    b=io.BytesIO()
    with zipfile.ZipFile(b,"w",zipfile.ZIP_DEFLATED) as z:
        for ext,data in zip(("shp","shx","dbf"),io_buffers):
            z.writestr(f"tile_index/tile.{ext}",data.getvalue())
        z.writestr("tile_index/tile.prj",pyproj.CRS.from_epsg(4326).to_wkt(version="WKT1_ESRI"))
    return b.getvalue()


def test_exact_authority_sources_are_allowlisted():
    assert set(m.SOURCES)=={"White","Gallatin"}
    assert m.SOURCES["White"]["index"].endswith("/white_tile_index.zip")
    assert m.SOURCES["Gallatin"]["metadata"].endswith("/gallatin_2020_metadata.xml")
    assert m.allowed_url(m.SOURCES["White"]["index"])
    assert not m.allowed_url("https://evil.example/white_tile_index.zip")


def test_metadata_xml_must_parse_and_not_be_empty():
    assert m.validate_xml(b"<?xml version='1.0'?><metadata><idinfo /></metadata>")=="metadata"
    with pytest.raises(ValueError,match="XML"):
        m.validate_xml(b"not xml")


def test_shapefile_index_structure_and_count_verified(tmp_path):
    p=tmp_path/"index.zip";p.write_bytes(fixture_index_zip())
    report=m.validate_index(p)
    assert report["shapefile_feature_count"]==1
    assert report["shapefile_count"]==1
    assert report["source_crs"][0]["name"]
    assert report["zip_crc_verified"] is True


def test_zip_traversal_refused(tmp_path):
    p=tmp_path/"index.zip"
    with zipfile.ZipFile(p,"w") as z:
        z.writestr("../evil",b"bad")
    with pytest.raises(ValueError,match="UNTRUSTED_ZIP_MEMBER"):
        m.validate_index(p)


def test_refuses_shapefile_without_sidecar(tmp_path):
    p=tmp_path/"index.zip"
    with zipfile.ZipFile(p,"w") as z:
        z.writestr("tile_index/tile.shp",b"shp")
    with pytest.raises(ValueError,match="SIDECAR"):
        m.validate_index(p)


def test_download_checks_exact_url_and_hash(tmp_path):
    url=m.SOURCES["White"]["metadata"]
    body=b"<?xml version='1.0'?><metadata/>"
    class Resp:
        headers={"Content-Length":str(len(body))}
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def geturl(self):return url
        def __init__(self):self.done=False
        def read(self,n):
            if self.done:return b""
            self.done=True
            return body
    with patch.object(m.urllib.request,"urlopen",return_value=Resp()):
        result=m.download(url,tmp_path/"metadata.xml")
    assert result["bytes"]==len(body)
    assert result["sha256"]==hashlib.sha256(body).hexdigest()


def test_rejects_redirect_and_overflow(tmp_path):
    url=m.SOURCES["Gallatin"]["metadata"]
    class Resp:
        headers={"Content-Length":"120000000"}
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def geturl(self):return url
    with patch.object(m.urllib.request,"urlopen",return_value=Resp()):
        with pytest.raises(ValueError,match="SIZE_BUDGET"):
            m.download(url,tmp_path/"bad.xml")
    assert not (tmp_path/"bad.xml").exists()
