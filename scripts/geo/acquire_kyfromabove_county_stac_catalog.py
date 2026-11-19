#!/usr/bin/env python3
"""Acquire full KyFromAbove Phase1/Phase2 DEM *catalogs* intersecting 2026 Census counties.

This task retains source-original STAC search response bytes, independently
checks each paginated response and exact county geometry intersections, then
generates a SHA-256 attributed source-item inventory. It does NOT download
the COG/DEM pixels, certify NAVD88/geoid heights or assert full DEM coverage.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime,timezone
from pathlib import Path

STAC_ROOT="https://spved5ihrl.execute-api.us-west-2.amazonaws.com"
SOURCE_URL="https://www2.census.gov/geo/tiger/TIGER2026/COUNTY/tl_2026_us_county.zip"
COUNTIES={"21101":"Henderson, KY","21225":"Union, KY"}
COLLECTIONS=("dem-phase1","dem-phase2")
MAX_PAGES_PER_COLLECTION=70
MAX_RESPONSE_BYTES=4*1024*1024
MAX_TOTAL_BYTES=80*1024*1024
ASSET_HOST="kyfromabove.s3.us-west-2.amazonaws.com"
ASSET_ID=re.compile(r"^N[0-9]{3}E[0-9]{3}_[0-9]{4}_DEM_Phase[12]_cog\.tif$")


def search_url(bbox:tuple[float,float,float,float],collection:str,*,limit:int=100)->str:
    if collection not in COLLECTIONS or limit!=100 or len(bbox)!=4 or not all(math.isfinite(x) for x in bbox):
        raise ValueError("SOURCE_QUERY_INVALID")
    if not (bbox[0]<bbox[2] and bbox[1]<bbox[3] and -90<bbox[0]<-86 and -90<bbox[2]<-86 and 36<bbox[1]<39 and 36<bbox[3]<39):
        raise ValueError("SOURCE_BOUNDING_BOX_OUTSIDE_REGION")
    params={"bbox":",".join(str(float(v)) for v in bbox),"collections":collection,"limit":str(limit)}
    return STAC_ROOT+"/search?"+urllib.parse.urlencode(params)


def validate_page_url(url:str,bbox:tuple[float,float,float,float],collection:str,limit:int)->bool:
    try:
        parsed=urllib.parse.urlparse(url)
        query=urllib.parse.parse_qs(parsed.query,keep_blank_values=True,strict_parsing=True)
        expected=tuple(float(x) for x in query["bbox"][0].split(","))
        if (parsed.scheme!="https" or parsed.netloc!="spved5ihrl.execute-api.us-west-2.amazonaws.com" or parsed.path!="/search"
            or parsed.params or parsed.fragment or parsed.username or parsed.password
            or set(query)-{"bbox","collections","limit","token"}
            or len(query.get("collections",[]))!=1 or query["collections"]!=[collection]
            or query.get("limit")!=[str(limit)] or len(expected)!=4
            or any(abs(x-y)>1e-8 for x,y in zip(expected,bbox))
            or (query.get("token") is not None and
                (len(query["token"])!=1 or not 0<len(query["token"][0])<=512))):
            raise ValueError("SOURCE_QUERY_OR_URL_UNTRUSTED")
    except (KeyError,ValueError,IndexError,TypeError) as exc:
        raise ValueError("SOURCE_URL_OR_QUERY_NOT_ALLOWLISTED") from exc
    return True


def fetch_source_bytes(url:str)->bytes:
    # All URLs must be validated against exact county bbox and source collection at call site.
    request=urllib.request.Request(url,headers={"User-Agent":"TSM-KyFromAbove-STAC-Source-Catalog/1.0","Accept":"application/geo+json"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request,timeout=90) as response:
                end=urllib.parse.urlparse(response.geturl())
                if end.scheme!="https" or end.netloc!="spved5ihrl.execute-api.us-west-2.amazonaws.com" or end.path!="/search":
                    raise ValueError("SOURCE_REDIRECT_OFFICIAL_HOST")
                length=response.headers.get("Content-Length")
                if length and int(length)>MAX_RESPONSE_BYTES:
                    raise ValueError("PAGE_SIZE_LIMIT")
                raw=response.read(MAX_RESPONSE_BYTES+1)
                if len(raw)>MAX_RESPONSE_BYTES or (length and int(length)!=len(raw)):
                    raise ValueError("PAGE_SIZE_LIMIT_OR_TRUNCATED")
                if not raw:raise ValueError("SOURCE_PAGE_EMPTY")
                return raw
        except urllib.error.HTTPError as exc:
            if attempt==2 or exc.code not in (429,500,502,503,504):raise
            time.sleep(2**attempt)
        except (TimeoutError,urllib.error.URLError):
            if attempt==2:raise
            time.sleep(2**attempt)
    raise RuntimeError("NO_SOURCE_RESPONSE")


def select_items(items:list, *,county_geom,county_fips:str,collection:str)->list[dict]:
    from shapely.geometry import shape
    if county_fips not in COUNTIES or collection not in COLLECTIONS:
        raise ValueError("COUNTY_OR_COLLECTION_NOT_ALLOWLISTED")
    result=[]
    for item in items:
        if item.get("type")!="Feature" or item.get("collection")!=collection:
            raise ValueError("SOURCE_COLLECTION_OR_FEATURE_TYPE_INVALID")
        geometry=item.get("geometry")
        if not geometry:raise ValueError("SOURCE_ITEM_GEOMETRY_MISSING")
        shp=shape(geometry)
        if shp.is_empty or not shp.is_valid:
            raise ValueError("SOURCE_ITEM_GEOMETRY_INVALID")
        if not shp.intersects(county_geom):
            continue
        item_id=item.get("id")
        if not isinstance(item_id,str) or not ASSET_ID.fullmatch(item_id):
            raise ValueError("UNTRUSTED_STAC_ITEM_ID")
        props=item.get("properties") or {}
        raw_asset=(item.get("assets") or {}).get("asset") or {}
        asset=raw_asset.get("href")
        expected_phase="Phase1" if collection=="dem-phase1" else "Phase2"
        expected_url=f"https://{ASSET_HOST}/elevation/DEM/{expected_phase}/{item_id}"
        if asset!=expected_url:
            raise ValueError("UNTRUSTED_STAC_ASSET")
        if props.get("proj:epsg")!=3089:
            raise ValueError("STAC_PROJECTION_UNEXPECTED")
        if not props.get("datetime"):
            raise ValueError("STAC_ACQUISITION_DATE_MISSING")
        if props.get("license")!="CC-BY-4.0":
            raise ValueError("STAC_LICENSE_NOT_PUBLIC_CC_BY")
        result.append({
            "county_fips":county_fips,
            "collection":collection,
            "source_item_id":item_id,
            "source_stac_item_url":f"{STAC_ROOT}/collections/{collection}/items/{item_id}",
            "source_dem_asset":asset,
            "source_horizontal_epsg":props["proj:epsg"],
            "source_raster_unit":(raw_asset.get("raster:bands") or [{}])[0].get("unit"),
            "source_license":props["license"],
            "source_acquisition_datetime":props["datetime"],
            "geometry_bbox_wgs84":item.get("bbox"),
            "raster_asset_type":raw_asset.get("type"),
            "asset_bytes_downloaded":False,
            "geom_intersects_exact_2026_census_county":True,
        })
    return result


def collect_collection(fips:str,county_geom,collection:str,root:Path,*,limit:int=100)->dict:
    if fips not in COUNTIES or collection not in COLLECTIONS:
        raise ValueError("COUNTY_OR_COLLECTION_NOT_ALLOWLISTED")
    bbox=county_geom.bounds
    next_url=search_url(bbox,collection,limit=limit)
    seen_urls=set()
    seen_items=set()
    rows=[]
    pages=[]
    total=0
    for page_num in range(MAX_PAGES_PER_COLLECTION):
        if next_url in seen_urls:
            raise ValueError("PAGINATION_CYCLE_DETECTED")
        validate_page_url(next_url,bbox,collection,limit)
        seen_urls.add(next_url)
        raw=fetch_source_bytes(next_url)
        total+=len(raw)
        if total>MAX_TOTAL_BYTES:
            raise ValueError("CATALOG_SIZE_BUDGET_EXCEEDED")
        parsed=json.loads(raw)
        if parsed.get("type")!="FeatureCollection" or not isinstance(parsed.get("features"),list):
            raise ValueError("STAC_FEATURE_COLLECTION_INVALID")
        if parsed.get("numberReturned") is not None and parsed["numberReturned"]!=len(parsed["features"]):
            raise ValueError("STAC_PAGE_ITEM_COUNT_DIVERGED")
        if len(parsed["features"])>limit:
            raise ValueError("STAC_PAGE_OVER_LIMIT")
        records=select_items(parsed["features"],county_geom=county_geom,county_fips=fips,collection=collection)
        for row in records:
            key=row["source_item_id"]
            if key in seen_items:
                raise ValueError("STAC_DUPLICATE_ITEM_ID")
            seen_items.add(key)
            rows.append(row)
        relative=f"{fips}/{collection}/pages/source-page-{page_num:03d}.json"
        dest=root/relative
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_bytes(raw)
        pages.append({"relative_path":relative,"sha256":hashlib.sha256(raw).hexdigest(),
                      "source_url":next_url,"bytes":len(raw),"page_raw_features":len(parsed["features"]),
                      "exact_county_items":len(records)})
        links=parsed.get("links",[])
        next_links=[x for x in links if x.get("rel")=="next"]
        if len(next_links)>1:raise ValueError("STAC_MULTIPLE_NEXT_LINKS")
        if not next_links:
            next_url=None
            break
        next_url=next_links[0].get("href")
        if not isinstance(next_url,str):
            raise ValueError("STAC_NEXT_LINK_MISSING")
        if next_url in seen_urls:raise ValueError("PAGINATION_CYCLE_DETECTED")
        validate_page_url(next_url,bbox,collection,limit)
    if next_url:
        raise ValueError("MAX_PAGES_EXCEEDED_INCOMPLETE_CATALOG")
    rows.sort(key=lambda x:x["source_item_id"])
    return {
        "county_fips":fips,"county":COUNTIES[fips],
        "collection":collection,
        "bbox_wgs84":list(bbox),
        "pages_received":len(pages),
        "page_receipts":pages,
        "unique_features_intersecting_exact_county":len(rows),
        "source_pages_sha256_verified":True,
        "items":rows,
        "all_dem_cog_pixels_downloaded":False,
        "source_vertical_datum_verified":False,
        "engineering_approved":False,
    }


def acquire(root:Path,boundary_geojson:Path)->dict:
    from shapely.geometry import shape
    data=json.loads(boundary_geojson.read_text(encoding="utf-8"))
    assert data.get("type")=="FeatureCollection"
    counties={}
    for f in data.get("features",[]):
        code=str((f.get("properties") or {}).get("GEOID",""))
        if code not in COUNTIES:
            continue
        if code in counties:
            raise ValueError("DUPLICATE_CENSUS_COUNTY_FIPS")
        county_geom=shape(f["geometry"])
        if county_geom.is_empty or not county_geom.is_valid or not all(math.isfinite(v) for v in county_geom.bounds):
            raise ValueError("INVALID_CENSUS_COUNTY_POLYGON")
        counties[code]=county_geom
    if set(counties)!=set(COUNTIES):
        raise ValueError("MISSING_REQUIRED_CENSUS_COUNTIES")
    input_sha=hashlib.sha256(boundary_geojson.read_bytes()).hexdigest()
    receipts=[]
    source_lines=[]
    for fips in COUNTIES:
        for collection in COLLECTIONS:
            details=collect_collection(fips,counties[fips],collection,root)
            receipts.append(details)
            for page in details["page_receipts"]:
                source_lines.append(f"{page['sha256']}  {page['relative_path']}\n")
    record={
        "schema":"tsm.kyfromabove.dem-2026-exact-county-phase-inventory.v1",
        "source_api":STAC_ROOT,"publisher":"Kentucky Division of Geographic Information (KyFromAbove)",
        "retrieved_at_utc":datetime.now(timezone.utc).isoformat(),
        "input_county_boundary_source":"U.S. Census TIGER/Line 2026 national COUNTY",
        "exact_county_source_file_sha256":input_sha,
        "county_fips":sorted(COUNTIES),
        "source_dem_phases":list(COLLECTIONS),
        "metadata_only_not_dem_tiffs":True,
        "source_raster_vertical_datum_verified":False,
        "per_collection":receipts,
        "all_original_stac_pages_hash_verified":True,
        "engineering_approved":False,
    }
    # Catalog JSON holds reviewed per-item fields; original response bytes remain separately inspectable.
    (root/"kyfromabove-catalog-receipt.json").write_text(json.dumps(record,indent=2,sort_keys=True,allow_nan=False)+"\n")
    (root/"SHA256SUMS.txt").write_text("".join(source_lines),encoding="utf-8")
    return record


def main()->None:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--boundary-geojson",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    result=acquire(args.output,args.boundary_geojson)
    print(json.dumps({"status":"STAC_SOURCE_PAGES_AND_EXACT_COUNTY_INTERSECTIONS_ACQUIRED",
        "source_page_count":sum(x["pages_received"] for x in result["per_collection"]),
        "exact_county_items":{x["county_fips"]+":"+x["collection"]:x["unique_features_intersecting_exact_county"] for x in result["per_collection"]},
        "DEM_source_TIFFs_downloaded":False,
        "engineer_approved":False},sort_keys=True))


if __name__=="__main__":
    main()
