"""Synthetic tests: official Posey inventory parsing, download budgets and CRS."""
import importlib.util
from pathlib import Path
from unittest.mock import patch
import pytest

PATH=Path(__file__).resolve().parents[2]/"scripts/geospatial/acquire_posey_2025_leafon.py"
spec=importlib.util.spec_from_file_location("posey2025",PATH)
assert spec and spec.loader
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

IMAGE="https://gisimageryleafoningov.s3.amazonaws.com/imageryoptimized/2025/SPW/06in/in2025_27179775_06.tif"
DSM="https://giselevationingov.s3.amazonaws.com/dsmoptimized/statewide/2025/SPW/1ft/in2025_27179775_06.tif"

def test_imagery_tiff_and_worldfile_manifest():
    rows=("﻿url_tif\r\n"+IMAGE+"\r\n"+IMAGE[:-4]+".tfw\r\n").encode()
    tiles,count=m.read_inventory("imagery2025",rows)
    assert count==2 and tiles=={"in2025_27179775_06":IMAGE}

def test_dsm_manifest():
    tiles,n=m.read_inventory("dsm2025",("url_dsm\n"+DSM+"\n").encode())
    assert n==1 and tiles["in2025_27179775_06"]==DSM

@pytest.mark.parametrize("url",[
    IMAGE.replace("https:","http:"),
    IMAGE.replace("gisimageryleafoningov","evil"),
    IMAGE+"?download=1",
    IMAGE.replace("/2025/","/2024/"),
    IMAGE.replace("in2025_27179775_06","../../in2025_27179775_06"),
])
def test_untrusted_inventory_url_rejected(url):
    with pytest.raises(ValueError):
        m.read_inventory("imagery2025",("url_tif\n"+url+"\n").encode())

def test_duplicate_tile_rejected():
    with pytest.raises(ValueError,match="DUPLICATE"):
        m.read_inventory("dsm2025",("url_dsm\n"+DSM+"\n"+DSM+"\n").encode())

def test_bad_header_rejected():
    with pytest.raises(ValueError,match="HEADER"):
        m.read_inventory("dsm2025",("url_tif\n"+DSM+"\n").encode())

def test_equivalent_horizontal_crs_overlap_and_nonoverlap():
    a={"horizontal_crs_embedded":"EPSG:2968","bounds_native_units":[0,0,5,5]}
    b={"horizontal_crs_embedded":"EPSG:2968","bounds_native_units":[1,1,4,4]}
    evidence=m.horizontal_raster_footprint_evidence(a,b)
    assert evidence["overlap"] is True
    assert evidence["operation"]=="EQUIVALENT_HORIZONTAL_CRS"
    assert evidence["vertical_datum_conversion_performed"] is False
    b["bounds_native_units"]=[5,5,10,10]
    assert not m.require_raster_footprint_overlap(a,b)


def test_distinct_horizontal_crs_uses_bounded_coordinate_transform():
    from rasterio.warp import transform_bounds
    a={"horizontal_crs_embedded":"EPSG:4326",
       "bounds_native_units":[-87.95,37.85,-87.90,37.90]}
    transformed=transform_bounds("EPSG:4326","EPSG:3857",
                                  *a["bounds_native_units"],densify_pts=21)
    b={"horizontal_crs_embedded":"EPSG:3857",
       "bounds_native_units":list(transformed)}
    evidence=m.horizontal_raster_footprint_evidence(a,b)
    assert evidence["overlap"] is True
    assert evidence["operation"]=="HORIZONTAL_BOUNDS_TRANSFORMED_TO_DSM_CRS"
    assert evidence["imagery_horizontal_epsg"]==4326
    assert evidence["dsm_horizontal_epsg"]==3857
    assert evidence["vertical_datum_conversion_performed"] is False
    b["bounds_native_units"]=[v+1e6 for v in transformed]
    assert not m.require_raster_footprint_overlap(a,b)


@pytest.mark.parametrize("bad",[
    [0,0,0,5],
    [5,0,0,5],
    [0,float("nan"),5,5],
    [0,0,5],
])
def test_invalid_bounds_rejected(bad):
    a={"horizontal_crs_embedded":"EPSG:2968","bounds_native_units":bad}
    b={"horizontal_crs_embedded":"EPSG:2968","bounds_native_units":[0,0,5,5]}
    with pytest.raises(ValueError,match="BOUNDS"):
        m.horizontal_raster_footprint_evidence(a,b)

def test_unparseable_crs_rejected():
    a={"horizontal_crs_embedded":"NOT_A_CRS",
       "bounds_native_units":[0,0,5,5]}
    b={"horizontal_crs_embedded":"EPSG:2968",
       "bounds_native_units":[0,0,5,5]}
    with pytest.raises(ValueError,match="CRS"):
        m.horizontal_raster_footprint_evidence(a,b)


def test_download_sha256_and_tiff_signature(tmp_path):
    class FakeResponse:
        headers={"Content-Length":"8"}
        def __init__(self):self.called=False
        def geturl(self):return IMAGE
        def read(self,size):
            if not self.called:
                self.called=True
                return b"II*\x00data"
            return b""
        def __enter__(self):return self
        def __exit__(self,*args):pass
    with patch.object(m.urllib.request,"urlopen",return_value=FakeResponse()):
        result=m.download(IMAGE,tmp_path/"one.tif",max_bytes=10,
            allowed_hostname="gisimageryleafoningov.s3.amazonaws.com")
    assert result["bytes"]==8 and len(result["sha256"])==64

def test_oversize_refused_before_writing_file(tmp_path):
    class FakeResponse:
        headers={"Content-Length":"800"}
        def geturl(self):return IMAGE
        def __enter__(self):return self
        def __exit__(self,*args):pass
    with patch.object(m.urllib.request,"urlopen",return_value=FakeResponse()):
        with pytest.raises(ValueError,match="SIZE_BUDGET"):
            m.download(IMAGE,tmp_path/"one.tif",max_bytes=10,
                allowed_hostname="gisimageryleafoningov.s3.amazonaws.com")
    assert not (tmp_path/"one.tif").exists()


def test_manifest_host_is_imagery_bucket_for_both_products():
    from urllib.parse import urlparse
    assert all(urlparse(source[0]).hostname == "gisimageryleafoningov.s3.amazonaws.com"
               for source in m.SOURCES.values())
    assert m.SOURCES["dsm2025"][1] == "giselevationingov.s3.amazonaws.com"
