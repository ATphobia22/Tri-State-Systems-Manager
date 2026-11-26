"""Additional raster evidence for source-bound reconstruction gaps.

Review-only. Raster products are correlated, may include vegetation, and
do not replace independently verified LiDAR or survey evidence.
"""
import argparse
from collections import Counter
from contextlib import ExitStack
import hashlib
import json
import math
from pathlib import Path
import sys
from urllib.request import urlopen, Request
import numpy as np
from pyproj import CRS, Transformer
import rasterio
from shapely.geometry import shape, mapping
from shapely.ops import transform
from rasterio.features import geometry_mask
from rasterio.windows import from_bounds, Window
from citybuilder.vertical_audit import verify
from citybuilder.vertical_bridge import GEO
from citybuilder.tsm_adapter import sha, read_local

MAX_TILE_BYTES=128*1024*1024
MAX_GRIDS=16
FTUS=1200/3937
LAYERS={
    "ndhm":"ndhmoptimized/statewide/2020/SPW/5ft/IN2020_{grid}_12_ndhm.tif",
    "dsm":"dsmoptimized/statewide/2020/SPW/5ft/IN2020_{grid}_12_dsm.tif",
    "dem":"demoptimized/statewide/2020/SPW/2.5ft/IN2020_{grid}_12.tif"}
HOST="https://giselevationingov.s3.amazonaws.com/"

def z_factor(unit, vertical_epsg):
    units={"m":1.0,"metre":1.0,"meter":1.0,"metres":1.0,"meters":1.0,
           "us survey foot":FTUS,"us survey feet":FTUS,"us_survey_feet":FTUS,"ftus":FTUS}
    explicit=units.get(str(unit).strip().lower())
    declared={5703:1.0,6360:FTUS}.get(vertical_epsg)
    if explicit is not None and declared is not None and explicit!=declared:
        raise ValueError("Conflicting raster Z units")
    return explicit if explicit is not None else declared

def assess_height(ndhm, delta, expected):
    a,b=np.asarray(ndhm,dtype=float),np.asarray(delta,dtype=float)
    a,b=a[np.isfinite(a)],b[np.isfinite(b)]
    result={"engineering_eligible":False,"publication_eligible":False,
            "height_m":None,"ndhm_count":len(a),"dsm_dem_count":len(b)}
    if expected<4 or min(len(a),len(b))<max(4,math.ceil(expected*.7)):
        return {**result,"status":"INSUFFICIENT_RASTER_COVERAGE"}
    h,d=float(np.median(a)),float(np.median(b))
    result.update(ndhm_median_m=h,dsm_dem_median_m=d)
    if not (0<h<=100 and 0<d<=100) or abs(h-d)>2:
        return {**result,"status":"RASTER_DISAGREEMENT"}
    return {**result,"status":"RASTER_HEIGHT_CANDIDATE","height_m":h}

def assess_contact(base,values,expected,tolerance):
    a=np.asarray(values,dtype=float)
    a=a[np.isfinite(a)]
    residual=a-base
    result={"sample_count":len(a),"expected_count":expected,"tolerance_m":tolerance,
            "max_abs_delta_m":float(np.max(np.abs(residual))) if len(a) else None,
            "rmse_m":float(np.sqrt(np.mean(residual**2))) if len(a) else None}
    status=("INCOMPLETE" if len(a)!=expected or expected==0 else
            "MISMATCH" if np.any(np.abs(residual)>tolerance) else "WITHIN_DIAGNOSTIC_TOLERANCE")
    return {**result,"status":status}

def fetch(url,path):
    digest=hashlib.sha256()
    size=0
    try:
        with urlopen(Request(url,headers={"User-Agent":"TSM-Raster-Recovery/1.0"}),timeout=60) as src,path.open("xb") as dst:
            while chunk:=src.read(1024*1024):
                size+=len(chunk)
                if size>MAX_TILE_BYTES:
                    raise ValueError("Raster download exceeds bound")
                digest.update(chunk)
                dst.write(chunk)
        return digest.hexdigest(),size
    except Exception:
        path.unlink(missing_ok=True)
        raise

def raster_info(ds,layer):
    if ds.count!=1 or ds.crs is None or ds.scales[0]!=1 or ds.offsets[0]!=0:
        raise ValueError("Unsupported raster band or scale")
    crs=CRS.from_user_input(ds.crs)
    horizontal=crs.sub_crs_list[0] if crs.is_compound else crs
    if horizontal.to_epsg()!=2968:
        raise ValueError("Unexpected raster horizontal CRS")
    vertical=crs.sub_crs_list[1].to_epsg() if crs.is_compound else None
    if layer in ("dem","dsm") and vertical not in (5703,6360):
        raise ValueError("Absolute raster NAVD88 CRS not established")
    factor=z_factor(ds.units[0],vertical)
    if factor is None:
        raise ValueError("Raster Z units not established")
    if ds.width*ds.height>16_000_000 or ds.dtypes[0] not in ("float32","float64","int16","int32"):
        raise ValueError("Unsupported raster size or type")
    return {"factor":factor,"vertical_epsg":vertical,"crs":crs.to_string(),"unit":ds.units[0]}

def sample(ds,info,x,y):
    if not (ds.bounds.left<=x<ds.bounds.right and ds.bounds.bottom<y<=ds.bounds.top):
        return None
    row,col=ds.index(x,y)
    if not (0<=row<ds.height and 0<=col<ds.width):
        return None
    v=ds.read(1,window=Window(col,row,1,1),masked=True)[0,0]
    return None if np.ma.is_masked(v) or not np.isfinite(v) else float(v)*info["factor"]

def run(review,out,tolerance):
    audit=verify(review)
    scene=json.loads(read_local(review/"source/scene.json"))
    receipt=json.loads(read_local(review/"candidate/vertical-reconstruction-receipt.json"))
    derived=json.loads(read_local(review/"candidate/source-bound-height-candidates.geojson"))["features"]
    base={f["id"]:f["properties"]["lidarGroundElevM"] for f in derived}
    missing=set(receipt["unavailable_ids"])
    project=Transformer.from_crs("EPSG:4326","EPSG:2968",always_xy=True)
    features=[(f["id"],transform(project.transform,shape(f["geometry"]))) for f in scene["buildings"]["features"]]
    grids=set()
    for sid,g in features:
        x0,y0,x1,y1=g.bounds
        grids.update((e,n) for e in range(math.floor(x0/5000),math.floor(x1/5000)+1)
                          for n in range(math.floor(y0/5000),math.floor(y1/5000)+1))
    if not grids or len(grids)>MAX_GRIDS:
        raise ValueError("Raster grid limit exceeded")
    out.mkdir(parents=True,exist_ok=False)
    sources=[]
    records=[]
    with ExitStack() as stack:
        rasters={}
        for e,n in sorted(grids):
            grid=f"{e*5:04d}{n*5:04d}"
            for layer,template in LAYERS.items():
                url=HOST+template.format(grid=grid)
                path=out/(grid+"-"+layer+".tif")
                record={"grid":grid,"layer":layer,"url":url}
                try:
                    digest,size=fetch(url,path)
                    record.update(sha256=digest,bytes=size)
                    ds=stack.enter_context(rasterio.open(path))
                    info=raster_info(ds,layer)
                    rasters[(e,n,layer)]=(ds,info)
                    record.update(info,status="HEADER_CHECKED")
                except (OSError,ValueError,rasterio.errors.RasterioError) as exc:
                    record.update(status="UNAVAILABLE_OR_UNVERIFIED",reason=str(exc)[:200])
                sources.append(record)
        def at(layer,x,y):
            item=rasters.get((math.floor(x/5000),math.floor(y/5000),layer))
            return sample(*item,x,y) if item else None
        for sid,g in features:
            if sid in missing:
                # Use DSM pixel centres on their native 5ft lattice; no interpolated roof values.
                a,b=[],[]
                expected=0
                for (e,n,layer),(ds,info) in rasters.items():
                    if layer!="dsm" or not g.intersects(shape({"type":"Polygon","coordinates":[[(ds.bounds.left,ds.bounds.bottom),(ds.bounds.right,ds.bounds.bottom),(ds.bounds.right,ds.bounds.top),(ds.bounds.left,ds.bounds.top),(ds.bounds.left,ds.bounds.bottom)]]})):
                        continue
                    win=from_bounds(*g.bounds,transform=ds.transform).round_offsets().round_lengths()
                    try:
                        win=win.intersection(Window(0,0,ds.width,ds.height))
                    except rasterio.errors.WindowError:
                        continue
                    win=Window(int(win.col_off),int(win.row_off),int(win.width),int(win.height))
                    if win.width<1 or win.height<1:
                        continue
                    mask=geometry_mask([mapping(g)],out_shape=(int(win.height),int(win.width)),transform=ds.window_transform(win),invert=True)
                    for rr,cc in zip(*np.where(mask)):
                        x,y=ds.xy(int(win.row_off)+int(rr),int(win.col_off)+int(cc))
                        if (math.floor(x/5000),math.floor(y/5000))!=(e,n):
                            continue
                        expected+=1
                        v,w,z=at("ndhm",x,y),at("dsm",x,y),at("dem",x,y)
                        if v is not None:a.append(v)
                        if w is not None and z is not None:b.append(w-z)
                records.append({"tsm_id":sid,"branch":"HEIGHT_GAP",**assess_height(a,b,expected)})
            else:
                polys=list(g.geoms) if g.geom_type=="MultiPolygon" else [g]
                vertices=[(x,y) for poly in polys for ring in (poly.exterior,*poly.interiors) for x,y in list(ring.coords)[:-1]]
                values=[at("dem",x,y) for x,y in vertices]
                records.append({"tsm_id":sid,"branch":"FOOTPRINT_BASE_CONTACT",
                    **assess_contact(base[sid],[v for v in values if v is not None],len(vertices),tolerance)})
    report={"schema":"tsm.raster-gap-and-contact-review.v1","source_audit":audit,
            "source_products":sources,"status_counts":dict(Counter(r["status"] for r in records)),
            "records":records,"engineering_eligible":False,"publication_eligible":False,
            "limitations":["Raster products are correlated, not independent survey checkpoints.",
             "Height estimates can include vegetation; no roof classification or promotion.",
             "Contact compares footprint boundary positions at nominal LiDAR ground median, not decoded GLB vertices.",
             "Tolerance is screening policy, not a certified accuracy standard."]}
    (out/"raster-review.json").write_text(json.dumps(report,indent=2,allow_nan=False)+"\n")
    print(json.dumps(report["status_counts"],sort_keys=True))

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("review",type=Path)
    p.add_argument("out",type=Path)
    p.add_argument("--contact-tolerance-m",type=float,required=True)
    a=p.parse_args()
    if not math.isfinite(a.contact_tolerance_m) or a.contact_tolerance_m<=0:
        p.error("Explicit positive diagnostic tolerance required")
    run(a.review,a.out,a.contact_tolerance_m)

if __name__=="__main__":
    main()
