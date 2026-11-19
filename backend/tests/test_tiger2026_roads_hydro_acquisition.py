"""Offline security and geometry tests for TIGER2026 nine-county road/water sources."""
import hashlib
import io
import zipfile
import importlib.util
from pathlib import Path
from unittest.mock import patch

import pytest

SCRIPT=Path(__file__).resolve().parents[2]/"scripts/geo/acquire_tiger2026_roads_hydro.py"
spec=importlib.util.spec_from_file_location("tiger2026_roads_hydro",SCRIPT)
assert spec and spec.loader
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def fake_shapefile_zip(fips="18129",kind="roads"):
    shapefile=pytest.importorskip("shapefile", reason="pyshp required for this spatial fixture")
    pyproj=pytest.importorskip("pyproj", reason="pyproj required for this spatial fixture")
    streams=[io.BytesIO(),io.BytesIO(),io.BytesIO()]
    shape_type=shapefile.POLYGON if kind=="areawater" else shapefile.POLYLINE
    with shapefile.Writer(shp=streams[0],shx=streams[1],dbf=streams[2],shapeType=shape_type) as writer:
        writer.field("NAME","C",size=40)
        if shape_type==shapefile.POLYGON:
            writer.poly([[[-88.1,37.8],[-88.1,37.9],[-88.,37.9],[-88.,37.8],[-88.1,37.8]]])
        else:
            writer.line([[[-88.1,37.8],[-88.,37.9]]])
        writer.record("fixture")
    prefix=f"tl_2026_{fips}_{kind}"
    data=io.BytesIO()
    with zipfile.ZipFile(data,"w",zipfile.ZIP_DEFLATED) as archive:
        for ext,buf in zip(("shp","shx","dbf"),streams):
            archive.writestr(prefix+"."+ext,buf.getvalue())
        archive.writestr(prefix+".prj",pyproj.CRS.from_epsg(4269).to_wkt(version="WKT1_ESRI"))
    return data.getvalue()


def test_county_and_class_contract():
    assert set(m.COUNTIES)=={"18129","18163","18051","18173","17193","17059","21101","21225","17185"}
    assert m.ENGINEERING_EIGHT=={"18129","18163","18051","18173","17193","17059","21101","21225"}
    assert m.EXTRA_REGIONAL=={"17185"}
    assert m.KINDS==("roads","linearwater","areawater")


def test_official_url_construction_is_bounded():
    assert m.tiger_source_url("18129","roads")=="https://www2.census.gov/geo/tiger/TIGER2026/ROADS/tl_2026_18129_roads.zip"
    assert m.tiger_source_url("21225","linearwater")=="https://www2.census.gov/geo/tiger/TIGER2026/LINEARWATER/tl_2026_21225_linearwater.zip"
    assert m.tiger_source_url("17059","areawater")=="https://www2.census.gov/geo/tiger/TIGER2026/AREAWATER/tl_2026_17059_areawater.zip"
    with pytest.raises(ValueError):
        m.tiger_source_url("99999","roads")
    with pytest.raises(ValueError):
        m.tiger_source_url("18129","any")
    assert len({m.tiger_source_url(f,k) for f in m.COUNTIES for k in m.KINDS})==27


def test_checks_valid_shapefile_and_crs(tmp_path):
    p=tmp_path/"roads.zip"
    p.write_bytes(fake_shapefile_zip())
    result=m.validate_archive(p,"18129","roads")
    assert result["feature_count"]==1
    assert result["source_crs_epsg"]==4269
    assert result["file_members_verified"]>=4
    assert result["geometry_type"] in ("POLYLINE","POLYGON")


def test_reject_zip_path_traversal(tmp_path):
    p=tmp_path/"bad.zip"
    with zipfile.ZipFile(p,"w") as zipout:
        zipout.writestr("tl_2026_18129_roads.shp",b"shp")
        zipout.writestr("../../evil.txt",b"owned")
    with pytest.raises(ValueError,match="UNTRUSTED_ZIP_MEMBER"):
        m.validate_archive(p,"18129","roads")


def test_reject_missing_shapefile_sidecar(tmp_path):
    p=tmp_path/"bad.zip"
    with zipfile.ZipFile(p,"w") as zipout:
        zipout.writestr("tl_2026_18129_roads.shp",b"shp")
    with pytest.raises(ValueError,match="MISSING_SHAPEFILE_SIDECAR"):
        m.validate_archive(p,"18129","roads")


def test_reject_unapproved_download_url(tmp_path):
    with pytest.raises(ValueError,match="NOT_ALLOWLISTED"):
        m.download("https://evil.example/tl_2026_18129_roads.zip",tmp_path/"x.zip")


def test_download_uses_exact_source_and_checks_sha(tmp_path):
    body=fake_shapefile_zip()
    url=m.tiger_source_url("18129","roads")
    class Response:
        headers={"Content-Length":str(len(body))}
        def __init__(self): self.remaining=body
        def geturl(self):return url
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def read(self,n):
            ret,self.remaining=self.remaining[:n],self.remaining[n:]
            return ret
    p=tmp_path/"road.zip"
    with patch.object(m.urllib.request,"urlopen",return_value=Response()):
        info=m.download(url,p)
    assert p.read_bytes()==body
    assert info["sha256"]==hashlib.sha256(body).hexdigest()
    assert info["bytes"]==len(body)


def test_reject_redirect_from_official_source(tmp_path):
    url=m.tiger_source_url("18129","roads")
    class Response:
        headers={}
        def geturl(self):return "https://evil.example/new.zip"
        def __enter__(self):return self
        def __exit__(self,*args):pass
    with patch.object(m.urllib.request,"urlopen",return_value=Response()):
        with pytest.raises(ValueError,match="REDIRECT"):
            m.download(url,tmp_path/"x.zip")
