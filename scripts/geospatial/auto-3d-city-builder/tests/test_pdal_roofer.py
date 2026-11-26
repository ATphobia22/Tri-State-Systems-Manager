import numpy as np
import pytest
from citybuilder.pdal_roofer import pipeline_for_points, raster_pipeline, normalized_height, shell_closed, classify_model

def test_point_pipeline_preserves_class_and_requires_compound_metric():
    p=pipeline_for_points(["a.laz","b.laz"],"metric.las",[0,0,100,100])
    assert any(s.get("out_srs")=="EPSG:2793+5703" for s in p)
    assert all(s["type"]!="filters.assign" for s in p)
    assert p[-1]["a_srs"]=="EPSG:2793+5703"

def test_raster_grid_shared_and_surface_not_classified_roof():
    dtm=raster_pipeline("metric.las","dtm.tif","dtm",[0,0,100,100])
    dsm=raster_pipeline("metric.las","dsm.tif","dsm",[0,0,100,100])
    assert dtm[1]["expression"]=="Classification == 2"
    assert "Classification == 1" in dsm[1]["expression"]
    assert all(dtm[-1][k]==dsm[-1][k] for k in ("origin_x","origin_y","width","height","resolution"))

def test_ndsm_does_not_replace_negative_or_nodata():
    a=np.ma.array([2.,5.,10.],mask=[0,0,1])
    b=np.ma.array([3.,2.,1.],mask=[0,0,0])
    n=normalized_height(a,b)
    assert n[0]==-1 and n[1]==3 and n.mask[2]

def test_shell_closed_rejects_open_or_invalid_mesh():
    vertices=[[0,0,0],[1,0,0],[0,1,0],[0,0,1]]
    shell=[[[0,2,1]],[[0,1,3]],[[1,2,3]],[[2,0,3]]]
    assert shell_closed(shell,vertices)
    assert not shell_closed(shell[:-1],vertices)
    assert not shell_closed(shell+[[[0,1,4]]],vertices)

def test_fallback_never_accepted_as_lod22():
    assert classify_model({"attributes":{"rf_extrusion_mode":"lod11_fallback"}},[])=="FALLBACK_OR_FAILED"
