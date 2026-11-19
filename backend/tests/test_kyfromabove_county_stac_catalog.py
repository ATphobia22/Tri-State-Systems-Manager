"""Offline tests for paginated KyFromAbove DEM catalogs and exact county intersections."""
import importlib.util
import json
from pathlib import Path
from unittest.mock import patch

import pytest

FILE=Path(__file__).resolve().parents[2]/"scripts/geo/acquire_kyfromabove_county_stac_catalog.py"
spec=importlib.util.spec_from_file_location("ky_stac_catalog",FILE)
assert spec and spec.loader
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def test_limit_to_2026_census_henderson_union_and_dem_collections():
    assert set(m.COUNTIES)=={"21101","21225"}
    assert m.COLLECTIONS==("dem-phase1","dem-phase2")
    assert m.STAC_ROOT=="https://spved5ihrl.execute-api.us-west-2.amazonaws.com"


def test_query_url_validates_bbox_collection_token_and_host():
    bbox=(-88.16,37.47,-87.73,37.90)
    url=m.search_url(bbox,"dem-phase1",limit=100)
    assert m.validate_page_url(url,bbox,"dem-phase1",100)
    with pytest.raises(ValueError,match="SOURCE_URL"):
        m.validate_page_url(url.replace(m.STAC_ROOT,"https://evil.example"),bbox,"dem-phase1",100)
    with pytest.raises(ValueError,match="SOURCE_QUERY"):
        m.validate_page_url(url.replace("dem-phase1","dem-phase2"),bbox,"dem-phase1",100)
    with pytest.raises(ValueError,match="SOURCE_QUERY"):
        m.validate_page_url(url+"&extra=evil",bbox,"dem-phase1",100)
    assert m.validate_page_url(url+"&token=next%3Atest",bbox,"dem-phase1",100)


def fake_feature(asset_id, *,bbox=(-87.95,37.68,-87.94,37.69),collection="dem-phase1"):
    a,b,c,d=bbox
    return {"id":asset_id,"type":"Feature","collection":collection,"bbox":list(bbox),
        "geometry":{"type":"Polygon","coordinates":[[[a,b],[c,b],[c,d],[a,d],[a,b]]]},
        "properties":{"proj:epsg":3089,"datetime":"2013-01-01T00:00:00Z","license":"CC-BY-4.0"},
        "assets":{"asset":{"href":"https://kyfromabove.s3.us-west-2.amazonaws.com/elevation/DEM/Phase1/"+asset_id,
                           "type":"image/tiff; application=geotiff; profile=cloud-optimized",
                           "raster:bands":[{"unit":"US survey foot"}]}}}


def test_select_only_items_intersecting_exact_polygon_and_allowlisted_dem():
    shapely=pytest.importorskip("shapely.geometry")
    boundary=shapely.box(-88,37.6,-87.8,37.8)
    good="N116E102_2013_DEM_Phase1_cog.tif"
    records=m.select_items([
        fake_feature(good),
        fake_feature("N116E103_2013_DEM_Phase1_cog.tif",bbox=(-87,38,-86.99,38.01))
    ],county_geom=boundary,county_fips="21225",collection="dem-phase1")
    assert len(records)==1
    assert records[0]["source_item_id"]==good
    assert records[0]["source_horizontal_epsg"]==3089
    assert records[0]["source_raster_unit"]=="US survey foot"
    assert records[0]["asset_bytes_downloaded"] is False


def test_reject_outside_provider_asset_and_wrong_collection():
    shapely=pytest.importorskip("shapely.geometry")
    f=fake_feature("N116E102_2013_DEM_Phase1_cog.tif")
    f["assets"]["asset"]["href"]="https://evil.example/asset.tif"
    with pytest.raises(ValueError,match="UNTRUSTED_STAC_ASSET"):
        m.select_items([f],county_geom=shapely.box(-88,37.6,-87.8,37.8),
                       county_fips="21225",collection="dem-phase1")
    f=fake_feature("N116E102_2013_DEM_Phase1_cog.tif",collection="dem-phase2")
    with pytest.raises(ValueError,match="COLLECTION"):
        m.select_items([f],county_geom=shapely.box(-88,37.6,-87.8,37.8),
                       county_fips="21225",collection="dem-phase1")


def test_pagination_tracks_checksum_and_rejects_duplicate_item(tmp_path):
    shapely=pytest.importorskip("shapely.geometry")
    geom=shapely.box(-88,37.6,-87.8,37.8)
    bbox=geom.bounds
    first=m.search_url(bbox,"dem-phase1",limit=100)
    second=first+"&token=next%3Atile01"
    item=fake_feature("N116E102_2013_DEM_Phase1_cog.tif")
    pages={first:{"type":"FeatureCollection","features":[item],
                  "links":[{"rel":"next","href":second}],"numberReturned":1},
           second:{"type":"FeatureCollection","features":[],
                   "links":[],"numberReturned":0}}
    def fake_bytes(url):
        return (json.dumps(pages[url],sort_keys=True)+"\n").encode("utf-8")
    with patch.object(m,"fetch_source_bytes",side_effect=fake_bytes):
        report=m.collect_collection("21225",geom,"dem-phase1",tmp_path,limit=100)
    assert report["pages_received"]==2
    assert report["unique_features_intersecting_exact_county"]==1
    assert all((tmp_path/x["relative_path"]).is_file() for x in report["page_receipts"])
    # Source pagination cannot silently accept the same item twice.
    pages[second]["features"]=[item]
    with patch.object(m,"fetch_source_bytes",side_effect=fake_bytes):
        with pytest.raises(ValueError,match="DUPLICATE"):
            m.collect_collection("21225",geom,"dem-phase1",tmp_path,limit=100)


def test_reject_infinite_page_cursor_cycle(tmp_path):
    shapely=pytest.importorskip("shapely.geometry")
    geom=shapely.box(-88,37.6,-87.8,37.8)
    url=m.search_url(geom.bounds,"dem-phase2",limit=100)
    data=json.dumps({"type":"FeatureCollection","features":[],
                     "numberReturned":0,"links":[{"rel":"next","href":url}]}).encode()
    with patch.object(m,"fetch_source_bytes",return_value=data):
        with pytest.raises(ValueError,match="PAGINATION_CYCLE"):
            m.collect_collection("21225",geom,"dem-phase2",tmp_path,limit=100)
