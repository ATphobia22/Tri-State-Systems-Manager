"""Regression tests for source-bounded Indiana 2025 county parcel acquisition."""
import hashlib
import importlib.util
from pathlib import Path
from unittest.mock import patch
import json
import pytest

SCRIPT=Path(__file__).resolve().parents[2]/"scripts/geo/acquire_igio_2025_parcels.py"
spec=importlib.util.spec_from_file_location("igio_parcel",SCRIPT)
assert spec and spec.loader
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def synthetic_feature(oid, fips="18129"):
    return {"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-88.1,37.8],[-88.1,37.9],[-88.0,37.9],[-88.1,37.8]]]},
            "properties":{"objectid":oid,"county_fips":fips,"state_parcel_id":str(oid),"parcel_id":"local-"+str(oid),
                          "PRIVATE_FIELD":"must never preserve"}}


def test_source_contract_and_county_filter():
    assert m.LAYER_URL=="https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0"
    assert m.COUNTY_FIPS=={"18129":"Posey","18051":"Gibson","18163":"Vanderburgh","18173":"Warrick"}
    assert m.where_for_county("18129")=="county_fips = '18129'"
    with pytest.raises(ValueError,match="COUNTY_NOT_ALLOWLISTED"):
        m.where_for_county("00000")


def test_ids_sort_and_exact_count():
    assert m.check_ids({"objectIds":[9,1,5]},expected_count=3)==[1,5,9]
    with pytest.raises(ValueError,match="DUPLICATE"):
        m.check_ids({"objectIds":[9,9]},expected_count=2)
    with pytest.raises(ValueError,match="COUNT"):
        m.check_ids({"objectIds":[1,2]},expected_count=3)


def test_page_checks_geometry_identity_and_minimum_fields():
    raw={"type":"FeatureCollection","features":[synthetic_feature(2),synthetic_feature(1)]}
    features=m.validate_page(raw,expected_ids=[1,2],fips="18129")
    assert len(features)==2
    assert features[0]["properties"]["objectid"]==1
    assert features[1]["properties"]["objectid"]==2
    assert set(features[0]["properties"])=={"objectid","county_fips","state_parcel_id","parcel_id"}
    assert "PRIVATE_FIELD" not in str(features)


def test_page_rejects_mismatched_county_and_missing_id():
    bad={"type":"FeatureCollection","features":[synthetic_feature(1,"18051")]}
    with pytest.raises(ValueError,match="COUNTY_FIPS"):
        m.validate_page(bad,expected_ids=[1],fips="18129")
    bad["features"][0]["properties"].pop("objectid")
    with pytest.raises(ValueError,match="OBJECTID"):
        m.validate_page(bad,expected_ids=[1],fips="18129")


def test_page_rejects_duplicates_missing_feature_and_malformed_geometry():
    bad={"type":"FeatureCollection","features":[synthetic_feature(1),synthetic_feature(1)]}
    with pytest.raises(ValueError,match="DUPLICATE"):
        m.validate_page(bad,expected_ids=[1,2],fips="18129")
    bad["features"]=[synthetic_feature(1)]
    with pytest.raises(ValueError,match="IDENTITY"):
        m.validate_page(bad,expected_ids=[1,2],fips="18129")
    bad["features"][0]["geometry"]={"type":"Point","coordinates":[-88.1,37.8]}
    with pytest.raises(ValueError,match="GEOMETRY"):
        m.validate_page(bad,expected_ids=[1],fips="18129")


def test_network_follows_exact_layer_and_blocks_redirects():
    with pytest.raises(ValueError,match="NOT_ALLOWLISTED"):
        m.fetch_json("https://fake.example/query",{"f":"json"})
    url=m.LAYER_URL+"/query"
    class Resp:
        headers={"Content-Length":"200"}
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def geturl(self):return "https://fake.example/query"
    with patch.object(m.urllib.request,"urlopen",return_value=Resp()):
        with pytest.raises(ValueError,match="REDIRECT"):
            m.fetch_json(url,{"f":"json"})


def test_county_acquisition_with_mock_pages_is_complete_and_checksummed(tmp_path):
    fips="18129"
    def data(url,parameters):
        if url==m.LAYER_URL and parameters.get("f")=="json":
            return {"objectIdField":"objectid","maxRecordCount":2000,"advancedQueryCapabilities":{"supportsPagination":True},
                    "fields":[{"name":v} for v in ("objectid","county_fips","state_parcel_id","parcel_id")],
                    "editingInfo":{"lastEditDate":123456},"geometryType":"esriGeometryPolygon"}
        if parameters.get("returnCountOnly")=="true":
            return {"count":3}
        if parameters.get("returnIdsOnly")=="true":
            return {"objectIds":[9,1,5]}
        if parameters.get("f")=="geojson":
            expected=list(map(int,parameters["objectIds"].split(",")))
            return {"type":"FeatureCollection","features":[synthetic_feature(x) for x in expected]}
        raise AssertionError(parameters)
    with patch.object(m,"fetch_json",side_effect=data):
        manifest=m.acquire_county(fips,tmp_path,chunk_size=2)
    assert manifest["status"]=="SOURCE_IDENTITY_AND_PAGE_HASHES_VERIFIED"
    assert manifest["feature_count"]==3
    assert manifest["pages"]==2
    assert manifest["source_crs_epsg"]==4326
    assert manifest["engineering_approved"] is False
    pages=list(tmp_path.glob("pages/*.geojson"))
    assert len(pages)==2
    for item in manifest["page_hashes"]:
        p=tmp_path/item["relative_path"]
        assert hashlib.sha256(p.read_bytes()).hexdigest()==item["sha256"]
        assert "PRIVATE_FIELD" not in p.read_text()


def test_snapshot_drift_rejected(tmp_path):
    seen={"reads":0}
    def data(url,params):
        if url==m.LAYER_URL:
            return {"objectIdField":"objectid","maxRecordCount":2000,"advancedQueryCapabilities":{"supportsPagination":True},
                    "fields":[{"name":v} for v in ("objectid","county_fips","state_parcel_id","parcel_id")],
                    "editingInfo":{"lastEditDate":123},"geometryType":"esriGeometryPolygon"}
        if params.get("returnCountOnly")=="true": return {"count":1}
        if params.get("returnIdsOnly")=="true":
            seen["reads"]+=1
            return {"objectIds":[1] if seen["reads"]==1 else [2]}
        return {"type":"FeatureCollection","features":[synthetic_feature(1)]}
    with patch.object(m,"fetch_json",side_effect=data):
        with pytest.raises(ValueError,match="DRIFT"):
            m.acquire_county("18129",tmp_path,chunk_size=1)
