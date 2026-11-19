"""Offline unit tests for official Kentucky STAC DEM tile sample acquisition."""
import importlib.util
import hashlib
import math
from pathlib import Path
import json
from unittest.mock import patch

import pytest

PATH=Path(__file__).resolve().parents[2]/"scripts/geo/acquire_kyfromabove_dem_samples.py"
spec=importlib.util.spec_from_file_location("ky_dem_source",PATH)
assert spec and spec.loader
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def stac_item(fips):
    data=m.TARGETS[fips]
    lon,lat=data["point"]
    return {"type":"Feature","id":data["item_id"],"collection":data["collection"],
            "bbox":[lon-.01,lat-.01,lon+.01,lat+.01],
            "properties":{"license":"CC-BY-4.0","proj:epsg":3089,"datetime":"2020-01-01T00:00:00Z"},
            "assets":{"asset":{"href":data["expected_asset"],"type":"image/tiff; application=geotiff; profile=cloud-optimized",
                     "raster:bands":[{"unit":"US survey foot"}]}}}


def test_two_exact_counties_and_bare_earth_dem_eras():
    assert set(m.TARGETS)=={"21101","21225"}
    assert m.TARGETS["21101"]["collection"]=="dem-phase2"
    assert m.TARGETS["21225"]["collection"]=="dem-phase1"
    assert m.TARGETS["21101"]["item_id"].endswith("_2020_DEM_Phase2_cog.tif")
    assert m.TARGETS["21225"]["item_id"].endswith("_2013_DEM_Phase1_cog.tif")


def test_source_item_passes_exact_asset_and_point_containment():
    for fips in m.TARGETS:
        report=m.validate_item(fips,stac_item(fips))
        assert report["asset"]==m.TARGETS[fips]["expected_asset"]
        assert report["source_horizontal_epsg"]==3089
        assert report["source_licence"]=="CC-BY-4.0"


def test_rejects_wrong_item_and_off_host_asset():
    s=stac_item("21101");s["id"]="evil"
    with pytest.raises(ValueError,match="ITEM"):
        m.validate_item("21101",s)
    s=stac_item("21101");s["assets"]["asset"]["href"]="https://evil.example/no.tif"
    with pytest.raises(ValueError,match="ASSET"):
        m.validate_item("21101",s)


def test_rejects_sample_point_outside_item_bbox():
    item=stac_item("21225")
    item["bbox"]=[-88.5,36.1,-88.4,36.2]
    with pytest.raises(ValueError,match="SAMPLE_POINT"):
        m.validate_item("21225",item)


def test_raw_binary_download_rejects_official_host_redirect(tmp_path):
    url=m.TARGETS["21101"]["expected_asset"]
    class Resp:
        headers={"Content-Length":"12"}
        def geturl(self):return "https://evil.example/image.tif"
        def __enter__(self):return self
        def __exit__(self,*args):pass
    with patch.object(m.urllib.request,"urlopen",return_value=Resp()):
        with pytest.raises(ValueError,match="REDIRECT"):
            m.download(url,tmp_path/"x.tif",max_bytes=100)


def test_download_tiff_checks_magic_and_hash(tmp_path):
    url=m.TARGETS["21101"]["expected_asset"]
    content=b"II*\x00sample-tiff"
    class Resp:
        headers={"Content-Length":str(len(content))}
        def __init__(self):self.remaining=content
        def geturl(self):return url
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def read(self,n):
            b,self.remaining=self.remaining[:n],self.remaining[n:]
            return b
    with patch.object(m.urllib.request,"urlopen",return_value=Resp()):
        r=m.download(url,tmp_path/"x.tif",max_bytes=100)
    assert r["bytes"]==len(content)
    assert r["sha256"]==hashlib.sha256(content).hexdigest()


def test_download_rejects_unknown_external_source(tmp_path):
    with pytest.raises(ValueError,match="NOT_ALLOWLISTED"):
        m.download("https://evil.example/stream",tmp_path/"x.tif")


def test_raster_horizontal_point_inspection_without_datum_certification(tmp_path):
    pytest.importorskip("rasterio")
    import rasterio
    from rasterio.transform import from_origin
    import numpy as np
    data=m.TARGETS["21101"]
    lon,lat=data["point"]
    p=tmp_path/"synthetic.tif"
    with rasterio.open(p,"w",driver="GTiff",height=16,width=16,count=1,dtype="float32",crs="EPSG:4326",
                       transform=from_origin(lon-.005,lat+.005,.001,.001),nodata=-999999) as out:
        out.write(np.full((16,16),450.0,dtype="float32"),1)
    r=m.raster_metadata(p,point=(lon,lat))
    assert r["sample_pixel_is_valid"] is True
    assert r["source_vertical_datum_verified"] is False
    assert r["horizontal_crs_wkt"]
