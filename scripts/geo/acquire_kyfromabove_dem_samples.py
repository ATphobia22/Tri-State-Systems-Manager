#!/usr/bin/env python3
"""Acquire one official KyFromAbove DEM COG tile per Kentucky target county.

Sample points are inside official census county polygons, but only those
points/tiles are tested. This is not a countywide DEM acquisition, proof of
source vertical datum, flood hydraulics or engineering certification.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import tempfile
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

STAC_ROOT="https://spved5ihrl.execute-api.us-west-2.amazonaws.com"
TARGETS={
    "21101":{
        "county":"Henderson",
        "collection":"dem-phase2",
        "item_id":"N108E123_2020_DEM_Phase2_cog.tif",
        "point":(-87.57774170368636,37.8068145),
        "expected_asset":"https://kyfromabove.s3.us-west-2.amazonaws.com/elevation/DEM/Phase2/N108E123_2020_DEM_Phase2_cog.tif",
    },
    "21225":{
        "county":"Union",
        "collection":"dem-phase1",
        "item_id":"N116E102_2013_DEM_Phase1_cog.tif",
        "point":(-87.94650742344695,37.68578),
        "expected_asset":"https://kyfromabove.s3.us-west-2.amazonaws.com/elevation/DEM/Phase1/N116E102_2013_DEM_Phase1_cog.tif",
    },
}
MAX_TIFF_BYTES=90*1024*1024
MAX_JSON_BYTES=1024*1024


def item_url(fips:str)->str:
    if fips not in TARGETS:
        raise ValueError("COUNTY_NOT_ALLOWLISTED")
    entry=TARGETS[fips]
    return f"{STAC_ROOT}/collections/{entry['collection']}/items/{entry['item_id']}"


def validate_item(fips:str, item:dict)->dict:
    if fips not in TARGETS:
        raise ValueError("COUNTY_NOT_ALLOWLISTED")
    entry=TARGETS[fips]
    if (item.get("type")!="Feature" or item.get("id")!=entry["item_id"]
            or item.get("collection")!=entry["collection"]):
        raise ValueError("STAC_ITEM_ID_OR_COLLECTION_MISMATCH")
    bounds=item.get("bbox")
    lon,lat=entry["point"]
    if (not isinstance(bounds,list) or len(bounds)!=4 or
            not all(isinstance(v,(int,float)) and math.isfinite(v) for v in bounds) or
            not bounds[0]<=lon<=bounds[2] or not bounds[1]<=lat<=bounds[3]):
        raise ValueError("STAC_SAMPLE_POINT_NOT_IN_TILE")
    props=item.get("properties") or {}
    if (props.get("proj:epsg")!=3089 or props.get("license")!="CC-BY-4.0"
            or not props.get("datetime")):
        raise ValueError("STAC_CRS_LICENSE_OR_VINTAGE_UNEXPECTED")
    asset=(item.get("assets") or {}).get("asset") or {}
    if (asset.get("href")!=entry["expected_asset"] or
            not asset.get("type","").startswith("image/tiff")):
        raise ValueError("STAC_ASSET_NOT_EXPECTED_PUBLIC_DEM")
    return {"item_id":entry["item_id"],"collection":entry["collection"],
            "asset":asset["href"],"source_horizontal_epsg":3089,
            "source_licence":props["license"],"acquisition_datetime":props["datetime"],
            "source_raster_unit":(asset.get("raster:bands") or [{}])[0].get("unit"),
            "bbox_wgs84":bounds,"sample_point_wgs84":[lon,lat],
            "reported_projection_bbox":props.get("proj:bbox"),
            "reported_projection_shape":props.get("proj:shape")}


def _check_allowed_url(url:str):
    if url not in set(t["expected_asset"] for t in TARGETS.values()) | {item_url(f) for f in TARGETS}:
        raise ValueError("DOWNLOAD_URL_NOT_ALLOWLISTED")


def download(url:str,destination:Path,*,max_bytes:int=MAX_TIFF_BYTES)->dict:
    _check_allowed_url(url)
    if not 1<=max_bytes<=MAX_TIFF_BYTES:
        raise ValueError("DOWNLOAD_SIZE_BUDGET_INVALID")
    destination.parent.mkdir(parents=True,exist_ok=True)
    fd,name=tempfile.mkstemp(prefix=".ky-source-",suffix=".part",dir=destination.parent)
    os.close(fd)
    tmp=Path(name)
    total=0
    sha=hashlib.sha256()
    try:
        req=urllib.request.Request(url,headers={"User-Agent":"TSM-KyFromAbove-Source-Receipt/1.0"})
        with urllib.request.urlopen(req,timeout=120) as response:
            if response.geturl()!=url:
                raise ValueError("DOWNLOAD_REDIRECT_OFF_AUTHORITY_SOURCE")
            declared=response.headers.get("Content-Length")
            if declared and int(declared)>max_bytes:
                raise ValueError("DOWNLOAD_EXCEEDS_SIZE_BUDGET")
            last_modified=response.headers.get("Last-Modified")
            content_type=response.headers.get("Content-Type")
            with tmp.open("wb") as target:
                while True:
                    data=response.read(1024*1024)
                    if not data:break
                    total+=len(data)
                    if total>max_bytes:raise ValueError("DOWNLOAD_EXCEEDS_SIZE_BUDGET")
                    target.write(data)
                    sha.update(data)
        if declared and total!=int(declared):
            raise ValueError("DOWNLOAD_INCOMPLETE_CONTENT_LENGTH")
        if total==0:raise ValueError("EMPTY_SOURCE")
        if destination.suffix.lower()==".tif":
            with tmp.open("rb") as source:
                if source.read(4) not in (b"II*\x00",b"MM\x00*"):
                    raise ValueError("SOURCE_NOT_CLASSIC_TIFF")
        os.replace(tmp,destination)
    finally:
        tmp.unlink(missing_ok=True)
    return {"source_url":url,"bytes":total,"sha256":sha.hexdigest(),
            "source_content_type":content_type,"source_last_modified":last_modified}


def raster_metadata(path:Path, *,point:tuple[float,float])->dict:
    import rasterio
    from rasterio.warp import transform
    with rasterio.open(path) as data:
        if data.driver!="GTiff" or not data.crs or data.width<=0 or data.height<=0 or data.count<1:
            raise ValueError("INVALID_GEOREFERENCED_DEM_TIFF")
        x,y=transform("EPSG:4326",data.crs,[point[0]],[point[1]])
        point_x,point_y=x[0],y[0]
        bounds=data.bounds
        if not (bounds.left<=point_x<=bounds.right and bounds.bottom<=point_y<=bounds.top):
            raise ValueError("RASTER_DOES_NOT_COVER_SAMPLE_POINT")
        sample=next(data.sample([(point_x,point_y)],indexes=1,masked=True))
        value=sample[0]
        valid=not getattr(value,"mask",False) and math.isfinite(float(value))
        info={
            "source_crs_epsg":data.crs.to_epsg(),
            "horizontal_crs_wkt":data.crs.to_wkt(),
            "width":data.width,"height":data.height,
            "count":data.count,"dtype":data.dtypes[0],
            "source_resolution_native_units":list(data.res),
            "bounds_native_units":[bounds.left,bounds.bottom,bounds.right,bounds.top],
            "sample_point_wgs84":list(point),
            "sample_pixel_is_valid":bool(valid),
            "sample_pixel_value_native_units":float(value) if valid else None,
            "source_nodata":data.nodata,
            "source_tags":dict(data.tags()),
            "source_vertical_datum_verified":False,
            "engineering_approved":False,
        }
        if not valid:raise ValueError("DEM_SAMPLE_PIXEL_NODATA_OR_INVALID")
        return info


def acquire(fips:str, root:Path)->dict:
    if fips not in TARGETS:raise ValueError("COUNTY_NOT_ALLOWLISTED")
    entry=TARGETS[fips]
    root.mkdir(parents=True,exist_ok=True)
    item_file=root/"official-stac-item.json"
    item_receipt=download(item_url(fips),item_file,max_bytes=MAX_JSON_BYTES)
    item=json.loads(item_file.read_text("utf-8"))
    evidence=validate_item(fips,item)
    raster_file=root/entry["item_id"]
    raster_receipt=download(evidence["asset"],raster_file,max_bytes=MAX_TIFF_BYTES)
    metadata=raster_metadata(raster_file,point=entry["point"])
    if metadata["source_crs_epsg"]!=evidence["source_horizontal_epsg"]:
        raise ValueError("SOURCE_STAC_RASTER_CRS_CONFLICT")
    original_bytes=item_file.read_bytes()
    assert hashlib.sha256(original_bytes).hexdigest()==item_receipt["sha256"]
    report={
        "schema":"tsm.kyfromabove.dem-sample-original-cog.v1",
        "publisher":"Commonwealth of Kentucky Division of Geographic Information, KyFromAbove",
        "catalog":STAC_ROOT,
        "retrieved_at_utc":datetime.now(timezone.utc).isoformat(),
        "fips":fips,"county":entry["county"],
        "original_stac_item":{"relative_path":item_file.name,**item_receipt},
        "original_dem_cog":{"relative_path":raster_file.name,**raster_receipt},
        "stac_provenance":evidence,"raster_source_metadata":metadata,
        "source_product":"state-published LiDAR-derived DEM",
        "sample_only_not_full_county_coverage":True,
        "vertical_datum_and_geoid_transform_certified":False,
        "engineering_approved":False,
    }
    (root/"acquisition-receipt.json").write_text(json.dumps(report,sort_keys=True,indent=2,allow_nan=False)+"\n",encoding="utf-8")
    (root/"SHA256SUMS.txt").write_text(
        f"{item_receipt['sha256']}  {item_file.name}\n{raster_receipt['sha256']}  {raster_file.name}\n",encoding="utf-8")
    return report


def main()->None:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--county-fips",choices=sorted(TARGETS),required=True)
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    r=acquire(args.county_fips,args.output)
    print(json.dumps({"fips":args.county_fips,"tile":r["stac_provenance"]["item_id"],
        "cog_bytes":r["original_dem_cog"]["bytes"],"horizontal_epsg":r["raster_source_metadata"]["source_crs_epsg"],
        "sample_pixel_is_valid":r["raster_source_metadata"]["sample_pixel_is_valid"],
        "vertical_datum_certified":False,"engineering_approved":False},sort_keys=True))


if __name__=="__main__":
    main()
