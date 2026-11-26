import copy
import json
import pytest
from public_external_preflight import ROOT,PROJECTS,check_registry,plan_ept,fetch_metadata

def test_restricted_registry_fail_closed():
    r=json.loads((ROOT/"external_registry.json").read_text())
    check_registry(r)
    for entry in r["items"]:
        if entry["id"]=="CEII":
            entry["automatic_download"]=True
    with pytest.raises(ValueError):
        check_registry(r)

def test_unknown_source_rejected_before_request():
    with pytest.raises(ValueError,match="Unregistered"):
        fetch_metadata("https://example.org/restricted")

def test_ept_requires_vertical_and_native_bounds():
    meta={"srs":{"authority":"EPSG","horizontal":"3857"},"bounds":[-10000000,4000000,0,-9000000,5000000,1000]}
    assert plan_ept(PROJECTS[0],meta)[1]=="VERTICAL_CRS_UNVERIFIED"
    meta["srs"]["vertical"]="5703"
    plan,status=plan_ept(PROJECTS[0],meta)
    assert status=="PLAN_ONLY_COVERAGE_UNVERIFIED"
    assert "[-978" in plan["pipeline"][0]["bounds"]
    assert plan["pipeline"][2]["out_srs"]=="EPSG:26916+5703"
    meta["bounds"]=[0,0,0,1,1,1]
    assert plan_ept(PROJECTS[0],meta)[1]=="AOI_OUTSIDE_PROJECT_BOUNDS"

def test_project_and_aoi_bounds():
    with pytest.raises(ValueError):
        plan_ept("other",{})
    with pytest.raises(ValueError):
        plan_ept(PROJECTS[0],{"srs":{"authority":"EPSG","horizontal":"3857","vertical":"5703"}},[-180,-90,180,90])
