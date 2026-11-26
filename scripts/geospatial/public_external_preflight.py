#!/usr/bin/env python3
"""Public-source-only acquisition preflight; never import restricted content.

Default execution fetches fixed public EPT and road-inventory metadata, not
restricted documents, tickets, parcel records or arbitrary URL payloads.
A runnable PDAL plan is emitted only with explicit compatible Z metadata.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import URLError
from pyproj import Transformer

ROOT=Path(__file__).resolve().parent
EPT_PREFIX="https://s3-us-west-2.amazonaws.com/usgs-lidar-public/"
PROJECTS=("IN_Statewide_Opt2_B6_2017","USGS_LPC_IN_WT_B12_Posey_2013_LAS_2016")
INDOT="https://gis.indot.in.gov/ro/rest/services/DOT/INDOT_NLRI_DATA/MapServer?f=json"
PILOT=(-87.900,37.929,-87.892,37.938)
BLOCKED={"CEII":"BLOCKED_BY_POLICY","PE_PLS":"HUMAN_LICENSE","IN_811":"MEMBER_API_OR_MANUAL","UNION_KY_PVA":"PUBLIC_OR_COMMERCIAL","TR-22-4_MODEL_ARCHIVE":"FOIA_OR_PUBLIC_SEARCH"}
MAX_METADATA=2*1024*1024

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        raise ValueError("Redirect requires separate public-source review")

def check_registry(registry):
    if registry.get("schema")!="tsm.external_data_registry.v1":
        raise ValueError("Registry schema")
    rows=registry["items"]
    by_id={r["id"]:r for r in rows}
    if len(by_id)!=len(rows):
        raise ValueError("Duplicate source identity")
    for ident,status in BLOCKED.items():
        if by_id.get(ident,{}).get("status")!=status:
            raise ValueError("Restricted source policy changed: "+ident)
    if any(r.get("automatic_download") is not False for r in rows):
        raise ValueError("Default registry must not authorize payload download")
    return by_id

def fetch_metadata(url):
    allowed={EPT_PREFIX+p+"/ept.json" for p in PROJECTS}|{INDOT}
    if url not in allowed:
        raise ValueError("Unregistered metadata URL")
    req=Request(url,headers={"User-Agent":"TSM-Public-Source-Preflight/1.0","Accept":"application/json"})
    with build_opener(NoRedirect()).open(req,timeout=45) as res:
        data=res.read(MAX_METADATA+1)
    if not data or len(data)>MAX_METADATA:
        raise ValueError("Metadata size limit")
    obj=json.loads(data)
    if not isinstance(obj,dict) or obj.get("error"):
        raise ValueError("Invalid public metadata response")
    return data,obj

def plan_ept(project,meta,bbox=PILOT):
    if project not in PROJECTS:
        raise ValueError("Project not allowlisted")
    srs=meta.get("srs",{})
    if srs.get("authority")!="EPSG" or str(srs.get("horizontal"))!="3857":
        return None,"HORIZONTAL_CRS_UNVERIFIED"
    if str(srs.get("vertical"))!="5703":
        return None,"VERTICAL_CRS_UNVERIFIED"
    if not isinstance(bbox,(tuple,list)) or len(bbox)!=4 or not all(type(v) in (float,int) and math.isfinite(v) for v in bbox):
        raise ValueError("Invalid AOI")
    w,s,e,n=bbox
    if not (-88.2<=w<e<=-87.6 and 37.6<=s<n<=38.3):
        raise ValueError("AOI outside bounded Posey review region")
    t=Transformer.from_crs(4326,3857,always_xy=True)
    x0,y0,x1,y1=t.transform_bounds(w,s,e,n,densify_pts=21)
    u=Transformer.from_crs(4326,26916,always_xy=True)
    a,b,c,d=u.transform_bounds(w,s,e,n,densify_pts=21)
    a,b,c,d=math.floor(a),math.floor(b),math.ceil(c),math.ceil(d)
    if (c-a)*(d-b)>4_000_000:
        raise ValueError("Raster cell budget exceeded")
    bounds=meta.get("boundsConforming",meta.get("bounds"))
    if not isinstance(bounds,list) or len(bounds)!=6 or not all(type(v) in (int,float) and math.isfinite(v) for v in bounds):
        return None,"SOURCE_EXTENT_UNVERIFIED"
    if not (bounds[0]<=x0<x1<=bounds[3] and bounds[1]<=y0<y1<=bounds[4]):
        return None,"AOI_OUTSIDE_PROJECT_BOUNDS"
    # Extent containment is not proof of actual coverage.
    return {"pipeline":[
        {"type":"readers.ept","filename":EPT_PREFIX+project+"/ept.json","bounds":f"([{x0},{x1}],[{y0},{y1}])"},
        {"type":"filters.expression","expression":"Classification == 2"},
        {"type":"filters.reprojection","out_srs":"EPSG:26916+5703","error_on_failure":True},
        {"type":"writers.gdal","filename":"posey_ground_1m.tif","resolution":1.0,"radius":2.5,"output_type":"idw","data_type":"float32","nodata":-9999,"origin_x":a,"origin_y":b,"width":c-a,"height":d-b}]}, "PLAN_ONLY_COVERAGE_UNVERIFIED"

def run(out):
    check_registry(json.loads((ROOT/"external_registry.json").read_text()))
    out.mkdir(parents=True,exist_ok=False)
    records=[]
    for key,url in [(p,EPT_PREFIX+p+"/ept.json") for p in PROJECTS]+[("INDOT_DOT",INDOT)]:
        r={"id":key,"url":url}
        try:
            raw,meta=fetch_metadata(url)
            (out/(key+".json")).write_bytes(raw)
            r.update(sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw))
            if key in PROJECTS:
                plan,status=plan_ept(key,meta)
                r.update(status=status,source_srs=meta.get("srs"))
                if plan:
                    (out/(key+"-pdal-plan.json")).write_text(json.dumps(plan,indent=2)+"\n")
            else:
                if not isinstance(meta.get("layers"),list):
                    raise ValueError("Road inventory metadata lacks layers")
                r.update(status="PUBLIC_METADATA_ONLY",layer_count=len(meta["layers"]))
        except (OSError,ValueError,URLError,TypeError,KeyError) as exc:
            r.update(status="SOURCE_UNAVAILABLE_OR_UNVERIFIED",error_type=type(exc).__name__)
        records.append(r)
    report={"schema":"tsm.public-external-preflight.v1","retrieved_at":datetime.now(timezone.utc).isoformat(),"pilot_bbox_wgs84":PILOT,"records":records,"engineering_eligible":False,"publication_eligible":False,"dem_generated":False,"restricted_payloads_acquired":False}
    (out/"receipt.json").write_text(json.dumps(report,indent=2,allow_nan=False)+"\n")
    print(json.dumps(report,indent=2))

if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out",type=Path,required=True)
    run(p.parse_args().out)
