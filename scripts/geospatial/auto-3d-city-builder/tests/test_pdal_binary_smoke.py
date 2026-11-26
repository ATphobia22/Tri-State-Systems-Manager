"""Opt-in integration test of the actual installed PDAL executable.

Synthetic fixture tests units, classification and raster output, never
a claim of local building/terrain accuracy.
"""
import os
from pathlib import Path
import laspy
import numpy as np
import pytest
import rasterio
from pyproj import CRS
from citybuilder.pdal_roofer import (
    execute, header, pipeline_for_points, raster_pipeline, pin_raster, normalized_height
)

def test_real_pdal_compound_crs_and_raster_contract(tmp_path):
    pdal=os.environ.get("TSM_PDAL_SMOKE")
    if not pdal:
        pytest.skip("Only the dedicated PDAL runtime job supplies the binary")
    source=tmp_path/"fixture.las"
    metric=tmp_path/"metric.las"
    h=laspy.LasHeader(point_format=6,version="1.4")
    h.scales=[0.01]*3
    h.offsets=[2715000,975000,0]
    h.add_crs(CRS.from_user_input("EPSG:2968+6360"))
    x,y=np.meshgrid(np.arange(2715001.,2715030.,2),np.arange(975001.,975030.,2))
    n=x.size
    points=laspy.LasData(h)
    points.x=np.concatenate([x.ravel(),x.ravel()])
    points.y=np.concatenate([y.ravel(),y.ravel()])
    points.z=np.concatenate([np.full(n,400.),np.full(n,420.)])
    points.classification=np.concatenate([np.full(n,2),np.full(n,1)]).astype(np.uint8)
    points.write(source)
    header(source,(2968,6360))
    ft=1200/3937
    x0,y0=int(np.floor(2715000*ft))-2,int(np.floor(975000*ft))-2
    bounds=[x0,y0,x0+15,y0+15]
    execute(pdal,pipeline_for_points([source],metric,bounds),tmp_path/"preprocess.json")
    receipt=header(metric,(2793,5703))
    data=laspy.read(metric)
    assert set(data.classification)=={1,2}
    assert np.median(np.asarray(data.z)[data.classification==2])==pytest.approx(400*ft,abs=0.02)
    assert np.median(np.asarray(data.z)[data.classification==1])==pytest.approx(420*ft,abs=0.02)
    for kind in ("dtm","dsm"):
        dest=tmp_path/(kind+".tif")
        execute(pdal,raster_pipeline(metric,dest,kind,bounds),tmp_path/(kind+".json"))
        pin_raster(dest,receipt["sha256"],kind)
    with rasterio.open(tmp_path/"dtm.tif") as dtm,rasterio.open(tmp_path/"dsm.tif") as dsm:
        assert dtm.transform==dsm.transform and dtm.crs==dsm.crs
        values=normalized_height(dsm.read(1,masked=True),dtm.read(1,masked=True)).compressed()
        assert len(values)>0
        assert np.median(values)==pytest.approx(20*ft,abs=0.03)
