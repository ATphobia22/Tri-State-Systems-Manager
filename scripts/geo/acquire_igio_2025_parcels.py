#!/usr/bin/env python3
"""Acquire county-exact, minimal-attribute Indiana GIO 2025 parcel geometry.

Uses only IGIO's published versioned FeatureServer/0. Queries the county_fips
field, captures the exact ObjectID set, requests bounded pages, validates
identity/geometry on every record and re-queries IDs to detect source drift.
Each byte-bearing GeoJSON page is SHA-256 recorded and archived privately.
No landowner, address, tax, legal-property, or personal fields are requested.
This is informational source evidence, not legal parcel determination or BFE.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

LAYER_URL="https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0"
COUNTY_FIPS={"18129":"Posey","18051":"Gibson","18163":"Vanderburgh","18173":"Warrick"}
PUBLIC_FIELDS=("objectid","county_fips","state_parcel_id","parcel_id")
MAX_RESPONSE_BYTES=24*1024*1024
MAX_FEATURES=200000
MAX_OUTPUT_BYTES=300*1024*1024
MAX_PAGE_SIZE=500


def where_for_county(fips:str) -> str:
    if fips not in COUNTY_FIPS:
        raise ValueError("COUNTY_NOT_ALLOWLISTED")
    return f"county_fips = '{fips}'"


def fetch_json(url:str, params:dict, *, max_bytes:int=MAX_RESPONSE_BYTES) -> dict:
    if url not in (LAYER_URL,LAYER_URL+"/query"):
        raise ValueError("SOURCE_URL_NOT_ALLOWLISTED")
    if not (1<=max_bytes<=MAX_RESPONSE_BYTES):
        raise ValueError("RESPONSE_SIZE_BUDGET_INVALID")
    exact=url+"?"+urllib.parse.urlencode(params)
    request=urllib.request.Request(exact,headers={"User-Agent":"Tri-State-Systems-Manager/IGIO-2025-Parcels", "Accept":"application/json"})
    # A transient 429/5xx can occur during state service maintenance.
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request,timeout=90) as response:
                parsed=urllib.parse.urlparse(response.geturl())
                if (parsed.scheme!="https" or parsed.netloc!="gisdata.in.gov"
                        or parsed.path!=urllib.parse.urlparse(url).path):
                    raise ValueError("SOURCE_REDIRECT_OUTSIDE_GOVERNMENT_ENDPOINT")
                declared=response.headers.get("Content-Length")
                if declared and int(declared)>max_bytes:
                    raise ValueError("RESPONSE_SIZE_BUDGET_EXCEEDED")
                payload=response.read(max_bytes+1)
                if len(payload)>max_bytes:
                    raise ValueError("RESPONSE_SIZE_BUDGET_EXCEEDED")
                if declared and len(payload)!=int(declared):
                    raise ValueError("RESPONSE_LENGTH_MISMATCH")
                result=json.loads(payload)
                if not isinstance(result,dict) or "error" in result:
                    raise ValueError("OFFICIAL_SOURCE_RETURNED_ERROR")
                return result
        except urllib.error.HTTPError as exc:
            if exc.code not in (429,500,502,503,504) or attempt==2:
                raise
            time.sleep(2**attempt)
        except (TimeoutError,urllib.error.URLError) as exc:
            if attempt==2:
                raise
            time.sleep(2**attempt)
    raise RuntimeError("UNREACHABLE_SOURCE")


def check_ids(result:dict, *,expected_count:int) -> list[int]:
    raw=result.get("objectIds")
    if not isinstance(raw,list):
        raise ValueError("SOURCE_OBJECTID_LIST_MISSING")
    if not isinstance(expected_count,int) or not 0<=expected_count<=MAX_FEATURES:
        raise ValueError("SOURCE_COUNT_INVALID_OR_OVERSIZED")
    if len(raw)!=expected_count:
        raise ValueError("SOURCE_COUNT_AND_OBJECTID_LIST_DIVERGE")
    if any(not isinstance(v,int) or isinstance(v,bool) or v<0 for v in raw):
        raise ValueError("SOURCE_OBJECTID_TYPE_INVALID")
    if len(set(raw))!=len(raw):
        raise ValueError("SOURCE_DUPLICATE_OBJECTIDS")
    return sorted(raw)


def validate_page(raw:dict, *,expected_ids:list[int],fips:str) -> list[dict]:
    if fips not in COUNTY_FIPS:
        raise ValueError("COUNTY_NOT_ALLOWLISTED")
    if raw.get("type")!="FeatureCollection" or not isinstance(raw.get("features"),list):
        raise ValueError("SOURCE_GEOJSON_COLLECTION_INVALID")
    clean=[]
    got=[]
    for feature in raw["features"]:
        if feature.get("type")!="Feature" or not isinstance(feature.get("properties"),dict):
            raise ValueError("SOURCE_FEATURE_INVALID")
        props={str(k).lower():v for k,v in feature["properties"].items()}
        oid=props.get("objectid")
        if not isinstance(oid,int) or isinstance(oid,bool):
            raise ValueError("SOURCE_OBJECTID_MISSING_OR_INVALID")
        if str(props.get("county_fips"))!=fips:
            raise ValueError("SOURCE_COUNTY_FIPS_MISMATCH")
        geo=feature.get("geometry")
        if not isinstance(geo,dict) or geo.get("type") not in ("Polygon","MultiPolygon") or not geo.get("coordinates"):
            raise ValueError("SOURCE_POLYGON_GEOMETRY_UNUSABLE")
        clean.append({"type":"Feature","id":oid,
                      "geometry":geo,
                      "properties":{k:props.get(k) for k in PUBLIC_FIELDS}})
        got.append(oid)
    if len(got)!=len(set(got)):
        raise ValueError("SOURCE_DUPLICATE_FEATURE_OBJECTID")
    if sorted(got)!=sorted(expected_ids):
        raise ValueError("SOURCE_PAGE_IDENTITY_MISMATCH")
    return sorted(clean,key=lambda x:x["properties"]["objectid"])


def acquire_county(fips:str, root:Path, *,chunk_size:int=250) -> dict:
    where=where_for_county(fips)
    if not 1<=chunk_size<=MAX_PAGE_SIZE:
        raise ValueError("INVALID_PAGE_SIZE")
    root.mkdir(parents=True,exist_ok=True)
    source_meta=fetch_json(LAYER_URL,{"f":"json"})
    if source_meta.get("geometryType")!="esriGeometryPolygon" or source_meta.get("objectIdField","").lower()!="objectid":
        raise ValueError("SOURCE_LAYER_GEOMETRY_OR_OBJECTID_CHANGED")
    fields={x["name"].lower() for x in source_meta.get("fields",[])}
    if not set(PUBLIC_FIELDS)<=fields:
        raise ValueError("SOURCE_REQUIRED_FIELDS_MISSING")
    if int(source_meta.get("maxRecordCount",0))<chunk_size:
        raise ValueError("SOURCE_PAGINATION_LIMIT_TOO_SMALL")
    snapshot_time=source_meta.get("editingInfo",{}).get("lastEditDate")
    common={"f":"json","where":where}
    count_resp=fetch_json(LAYER_URL+"/query",{**common,"returnCountOnly":"true"})
    count=count_resp.get("count")
    ids=check_ids(fetch_json(LAYER_URL+"/query",{**common,"returnIdsOnly":"true"}),expected_count=count)
    if not ids:
        raise ValueError("COUNTY_SOURCE_EMPTY")
    lines=[]
    receipts=[]
    total_bytes=0
    for page_num,start in enumerate(range(0,len(ids),chunk_size)):
        expected=ids[start:start+chunk_size]
        page=fetch_json(LAYER_URL+"/query",{
            "f":"geojson","objectIds":",".join(map(str,expected)),
            "outFields":",".join(PUBLIC_FIELDS),
            "returnGeometry":"true","outSR":"4326"
        })
        features=validate_page(page,expected_ids=expected,fips=fips)
        relative=f"pages/igio-2025-parcels-{fips}-p{page_num:04d}.geojson"
        target=root/relative
        target.parent.mkdir(parents=True,exist_ok=True)
        body=(json.dumps({"type":"FeatureCollection","features":features},separators=(",",":"),ensure_ascii=False,allow_nan=False)+"\n").encode("utf-8")
        total_bytes+=len(body)
        if total_bytes>MAX_OUTPUT_BYTES:
            raise ValueError("COUNTY_SOURCE_OUTPUT_SIZE_BUDGET_EXCEEDED")
        target.write_bytes(body)
        sha=hashlib.sha256(body).hexdigest()
        receipts.append({"relative_path":relative,"sha256":sha,
                        "bytes":len(body),"first_objectid":expected[0],
                        "last_objectid":expected[-1],"feature_count":len(features)})
        lines.append(f"{sha}  {relative}\n")
    again=check_ids(fetch_json(LAYER_URL+"/query",{**common,"returnIdsOnly":"true"}),expected_count=count)
    if again!=ids:
        raise ValueError("COUNTY_SOURCE_OBJECTID_SNAPSHOT_DRIFT")
    after=fetch_json(LAYER_URL,{"f":"json"})
    if snapshot_time!=after.get("editingInfo",{}).get("lastEditDate"):
        raise ValueError("COUNTY_SOURCE_EDIT_TIMESTAMP_DRIFT")
    report={"schema":"tsm.igio-2025-parcels-source-pages.v1",
            "status":"SOURCE_IDENTITY_AND_PAGE_HASHES_VERIFIED",
            "source_url":LAYER_URL,
            "service_layer_id":0,"source_dataset_year":2025,
            "publisher":"Indiana Geographic Information Office",
            "data_access":"public read; downstream licensing and agency review required",
            "retrieved_at_utc":datetime.now(timezone.utc).isoformat(),
            "county":COUNTY_FIPS[fips],"county_fips":fips,
            "filter":where,"feature_count":len(ids),"pages":len(receipts),
            "original_source_edit_timestamp":snapshot_time,
            "source_crs_epsg":4326,"output_crs_epsg":4326,
            "retained_fields":list(PUBLIC_FIELDS),"page_hashes":receipts,
            "payload_bytes":total_bytes,
            "source_identities_stable_across_run":True,
            "exact_census_polygon_intersection_verified":False,
            "property_boundary_legally_certified":False,
            "effective_fema_bfe_assigned":False,
            "engineering_approved":False}
    (root/"SHA256SUMS.txt").write_text("".join(lines),encoding="utf-8")
    (root/"source-acquisition-receipt.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    return report


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--county-fips",choices=sorted(COUNTY_FIPS),required=True)
    p.add_argument("--output",type=Path,required=True)
    p.add_argument("--chunk-size",type=int,default=250)
    args=p.parse_args()
    result=acquire_county(args.county_fips,args.output,chunk_size=args.chunk_size)
    print(json.dumps({"fips":args.county_fips,
                      "status":result["status"],
                      "feature_count":result["feature_count"],
                      "pages":result["pages"],
                      "engineering_approved":False},sort_keys=True))


if __name__=="__main__":
    main()
