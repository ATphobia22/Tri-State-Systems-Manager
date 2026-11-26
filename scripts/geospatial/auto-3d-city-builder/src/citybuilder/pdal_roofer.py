"""Source-bound PDAL and Roofer pilot: review products only, never publication."""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import subprocess
from urllib.request import Request,urlopen
import re
import numpy as np
import laspy
import rasterio
from pyproj import CRS,Transformer
from shapely.geometry import shape,mapping,Polygon
from shapely.ops import transform,unary_union
from citybuilder.vertical_audit import verify
from citybuilder.tsm_adapter import read_local,sha

HOST="https://giselevationingov.s3.amazonaws.com/copc/statewide/2020/SPW/ql2/"
METADATA="https://www.fisheries.noaa.gov/inport/item/69202"
INPUT_CRS="EPSG:2968+6360"
METRIC_CRS="EPSG:2793+5703"
PINNED_SCENE="b279c71f1bf7fc3b455cfa23ad42bd26d764d38db2b17ff2393b698fc4b22205"
PINNED_TILES={
"IN2020_27150980_12.copc.laz":"c591d9bb229fd3e9c38828c043a184e7568ba352fc91fe3d32313120ca8f36c6",
"IN2020_27150975_12.copc.laz":"60d34afd30e297fe75b4261a0bf3814b10eccaf5cd6ae2a4af376c6a7be2f2e0"}
FTUS=1200/3937

def digest(path):
    with Path(path).open("rb") as f:
        return hashlib.file_digest(f,"sha256").hexdigest()

def write_json(path,obj):
    Path(path).write_text(json.dumps(obj,indent=2,allow_nan=False)+"\n")

def download(url,path,expected=None,max_bytes=512*1024*1024):
    size=0
    try:
        with urlopen(Request(url,headers={"User-Agent":"TSM-PointCloud-Review/1.0"}),timeout=120) as src,path.open("xb") as dst:
            while block:=src.read(1024*1024):
                size+=len(block)
                if size>max_bytes:
                    raise ValueError("Download size limit")
                dst.write(block)
        actual=digest(path)
        if expected and actual!=expected:
            raise ValueError("Source digest mismatch: "+path.name)
        return actual
    except Exception:
        path.unlink(missing_ok=True)
        raise

def crs_codes(crs):
    if crs is None:
        return None,None
    c=CRS.from_user_input(crs)
    h,v=c.sub_crs_list[:2] if c.is_compound else (c,None)
    if h.is_bound:
        h=h.source_crs
    return h.to_epsg(),v.to_epsg() if v is not None else None

def header(path,expected):
    with laspy.open(path) as f:
        codes=crs_codes(f.header.parse_crs())
        if codes!=expected:
            raise ValueError(f"Unexpected compound point-cloud CRS: {codes}")
        if f.header.point_count<=0:
            raise ValueError("Empty point cloud")
        return {"crs":list(codes),"point_count":f.header.point_count,
            "mins":f.header.mins.tolist(),"maxs":f.header.maxs.tolist(),"sha256":digest(path)}

def pipeline_for_points(files,output,bounds):
    if not files:
        raise ValueError("No point clouds")
    x0,y0,x1,y1=bounds
    readers=[{"type":"readers.las","filename":str(f),"tag":f"source{i}"} for i,f in enumerate(files)]
    stages=readers
    if len(files)>1:
        stages.append({"type":"filters.merge","inputs":[r["tag"] for r in readers]})
    stages.extend([
        {"type":"filters.expression","expression":"(Classification == 1 || Classification == 2 || Classification == 6) && Withheld == 0"},
        {"type":"filters.reprojection","out_srs":METRIC_CRS,"error_on_failure":True},
        {"type":"filters.crop","bounds":f"([{x0},{x1}],[{y0},{y1}])"},
        {"type":"writers.las","filename":str(output),"a_srs":METRIC_CRS,"minor_version":4,
            "dataformat_id":6,"scale_x":0.01,"scale_y":0.01,"scale_z":0.01,
            "offset_x":"auto","offset_y":"auto","offset_z":"auto"}])
    return stages

def raster_pipeline(points,output,kind,bounds):
    x0,y0,x1,y1=bounds
    if kind not in ("dtm","dsm"):
        raise ValueError("Unknown raster kind")
    return [{"type":"readers.las","filename":str(points)},
        {"type":"filters.expression","expression":"Classification == 2" if kind=="dtm" else
             "Classification == 1 || Classification == 2 || Classification == 6"},
        {"type":"writers.gdal","filename":str(output),"resolution":1.0,"radius":1.5,
            "origin_x":x0,"origin_y":y0,"width":int(x1-x0),"height":int(y1-y0),
            "output_type":"idw" if kind=="dtm" else "max",
            "data_type":"float32","nodata":-9999,"gdalopts":"TILED=YES,COMPRESS=DEFLATE"}]

def execute(pdal,stages,path):
    write_json(path,{"pipeline":stages})
    subprocess.run([pdal,"pipeline",str(path)],check=True)

def normalized_height(dsm,dtm):
    return np.ma.asarray(dsm)-np.ma.asarray(dtm)

def pin_raster(path,point_sha,kind):
    with rasterio.open(path,"r+") as ds:
        if ds.count!=1 or ds.scales[0]!=1 or ds.offsets[0]!=0 or ds.crs is None:
            raise ValueError("Invalid generated raster")
        h,v=crs_codes(ds.crs)
        if h!=2793 or v not in (None,5703):
            raise ValueError("Generated raster conflicts with input CRS")
        # Only locally generated rasters: derive Z metadata from verified metric LAS.
        # Never relabel an external source raster or change its pixel values.
        ds.crs=rasterio.crs.CRS.from_wkt(CRS.from_user_input(METRIC_CRS).to_wkt())
        ds.set_band_unit(1,"m")
        ds.update_tags(TSM_Z_DATUM="NAVD88",TSM_SOURCE_GEOID="GEOID12B",
            TSM_Z_UNITS="m",TSM_POINT_SHA256=point_sha,TSM_PRODUCT=kind)
    with rasterio.open(path) as ds:
        a=ds.read(1,masked=True)
        if crs_codes(ds.crs)!=(2793,5703) or ds.units[0]!="m" or a.count()==0:
            raise ValueError("Generated raster metadata or coverage invalid")
        return {"sha256":digest(path),"horizontal_epsg":2793,"vertical_epsg":5703,
                "unit":"m","valid_count":int(a.count()),"shape":[ds.height,ds.width],
                "transform":list(ds.transform),"source_point_sha256":point_sha}

def shell_closed(shell,vertices):
    if not isinstance(shell,list) or len(shell)<4:
        return False
    edges=Counter()
    directed=Counter()
    for surface in shell:
        if not isinstance(surface,list) or not surface:
            return False
        for ring in surface:
            if (not isinstance(ring,list) or len(ring)<3 or len(set(ring))!=len(ring)
                    or any(type(i) is not int or i<0 or i>=len(vertices) for i in ring)):
                return False
            for a,b in zip(ring,ring[1:]+ring[:1]):
                edges[tuple(sorted((a,b)))]+=1
                directed[(a,b)]+=1
    return bool(edges) and all(n==2 and directed[(a,b)]==1 and directed[(b,a)]==1 for (a,b),n in edges.items())

def classify_model(obj,vertices):
    attrs=obj.get("attributes",{})
    if attrs.get("rf_extrusion_mode")!="standard" or attrs.get("rf_success") is not True:
        return "FALLBACK_OR_FAILED"
    lods=[g for g in obj.get("geometry",[]) if str(g.get("lod"))=="2.2" and g.get("type")=="Solid"]
    if not lods:
        return "NO_LOD22_SOLID"
    for g in lods:
        if not g.get("boundaries") or not all(shell_closed(s,vertices) for s in g["boundaries"]):
            return "OPEN_OR_INVALID_SHELL"
        semantics=g.get("semantics",{})
        types={s.get("type") for s in semantics.get("surfaces",[])}
        if not {"RoofSurface","GroundSurface","WallSurface"}<=types:
            return "MISSING_SURFACE_SEMANTICS"
    rmse=attrs.get("rf_rmse_lod22")
    planes=attrs.get("rf_roof_planes")
    if type(rmse) not in (float,int) or not math.isfinite(rmse) or not 0<=rmse<=0.5 or type(planes) is not int or planes<1:
        return "INSUFFICIENT_ROOF_FIT_EVIDENCE"
    return "LOD22_STRUCTURAL_REVIEW_CANDIDATE"

def model_review(out,originals):
    seen={}
    files={}
    for file in sorted(out.rglob("*.city.jsonl")):
        files[file.relative_to(out).as_posix()]=digest(file)
        with file.open() as f:
            first=json.loads(next(f))
            if first.get("type")!="CityJSON":
                raise ValueError("Missing CityJSONSeq header")
            transform_=first.get("transform",{})
            scale,offset=transform_.get("scale"),transform_.get("translate")
            if not isinstance(scale,list) or not isinstance(offset,list) or len(scale)!=3 or len(offset)!=3 or not all(math.isfinite(v) for v in scale+offset) or min(scale)<=0:
                raise ValueError("Missing valid CityJSONSeq transform")
            for line in f:
                feat=json.loads(line)
                sid=feat.get("id")
                if sid not in originals or sid in seen:
                    raise ValueError("Unrecognized or duplicate Roofer identity")
                objects=feat.get("CityObjects",{})
                parent=objects.get(sid,{})
                verts=feat.get("vertices",[])
                if any(not isinstance(v,list) or len(v)!=3 or not all(type(x) in (int,float) and math.isfinite(x) for x in v) for v in verts):
                    raise ValueError("Invalid CityJSON vertices")
                status=classify_model(parent,verts)
                if status=="LOD22_STRUCTURAL_REVIEW_CANDIDATE":
                    # Check actual decoded roof surface envelope against exact projected source.
                    decoded=[[a*b+c for a,b,c in zip(v,scale,offset)] for v in verts]
                    roofs=[]
                    for geom in parent["geometry"]:
                        if str(geom.get("lod"))!="2.2" or geom.get("type")!="Solid":
                            continue
                        sem=geom["semantics"]
                        for shell,values in zip(geom["boundaries"],sem["values"]):
                            for surf,idx in zip(shell,values):
                                if idx is not None and sem["surfaces"][idx]["type"]=="RoofSurface":
                                    poly=Polygon([decoded[i][:2] for i in surf[0]],[[decoded[i][:2] for i in ring] for ring in surf[1:]])
                                    if not poly.is_valid or poly.is_empty:
                                        status="INVALID_ROOF_PROJECTION"
                                    else:
                                        roofs.append(poly)
                    if not roofs:
                        status="MISSING_DECODED_ROOF"
                    elif status=="LOD22_STRUCTURAL_REVIEW_CANDIDATE":
                        roof=unary_union(roofs)
                        foot=originals[sid]["geometry"]
                        if foot.area<=0 or roof.intersection(foot).area/foot.area<0.8 or roof.difference(foot.buffer(0.5)).area/foot.area>0.1:
                            status="FOOTPRINT_ALIGNMENT_MISMATCH"
                seen[sid]={"tsm_id":sid,"source_feature_sha256":originals[sid]["sha"],"status":status,
                    "roof_source_class":1,"engineering_eligible":False,"publication_eligible":False}
    for sid in set(originals)-set(seen):
        seen[sid]={"tsm_id":sid,"source_feature_sha256":originals[sid]["sha"],"status":"NO_RECONSTRUCTION",
            "roof_source_class":1,"engineering_eligible":False,"publication_eligible":False}
    return {"records":[seen[sid] for sid in sorted(seen)],"file_sha256":files,
        "status_counts":dict(Counter(r["status"] for r in seen.values()))}

def run(review,out,pdal,ogr,roofer):
    audit=verify(review)
    scene_path=review/"source/scene.json"
    scene=json.loads(read_local(scene_path))
    receipt=json.loads(read_local(review/"candidate/vertical-reconstruction-receipt.json"))
    if sha(read_local(scene_path))!=PINNED_SCENE or receipt.get("raw_copc_tile_sha256")!=PINNED_TILES:
        raise ValueError("Baseline scene or source tiles changed")
    out.mkdir(parents=True,exist_ok=False)
    raw=out/"raw";raw.mkdir()
    sources={}
    for name,wanted in sorted(PINNED_TILES.items()):
        file=raw/name
        download(HOST+name,file,wanted)
        sources[name]=header(file,(2968,6360))
    meta=out/"source-metadata.html"
    meta_sha=download(METADATA,meta,max_bytes=10*1024*1024)
    project=Transformer.from_crs("EPSG:4326","EPSG:2793",always_xy=True)
    features=[]
    originals={}
    for f in scene["buildings"]["features"]:
        sid=f["id"]
        g=transform(project.transform,shape(f["geometry"]))
        if g.is_empty or not g.is_valid:
            raise ValueError("Invalid projected footprint")
        originals[sid]={"geometry":g,"sha":f["properties"]["source_feature_sha256"]}
        features.append({"type":"Feature","geometry":f["geometry"],"properties":{"tsm_id":sid,"source_sha":originals[sid]["sha"]}})
    fp=out/"footprints.geojson"
    write_json(fp,{"type":"FeatureCollection","features":features})
    gpkg=out/"footprints.gpkg"
    subprocess.run([ogr,"-f","GPKG",str(gpkg),str(fp),"-s_srs","EPSG:4326","-t_srs","EPSG:2793","-nln","buildings"],check=True)
    x0=min(g["geometry"].bounds[0] for g in originals.values())
    y0=min(g["geometry"].bounds[1] for g in originals.values())
    x1=max(g["geometry"].bounds[2] for g in originals.values())
    y1=max(g["geometry"].bounds[3] for g in originals.values())
    bounds=[math.floor(x0-25),math.floor(y0-25),math.ceil(x1+25),math.ceil(y1+25)]
    if (bounds[2]-bounds[0])*(bounds[3]-bounds[1])>4_000_000:
        raise ValueError("Pilot grid exceeds bound")
    points=out/"metric.las"
    execute(pdal,pipeline_for_points([raw/n for n in sorted(PINNED_TILES)],points,bounds),out/"preprocess.json")
    metric=header(points,(2793,5703))
    with laspy.open(points) as las:
        classes=Counter()
        for batch in las.chunk_iterator(500_000):
            keys,counts=np.unique(np.asarray(batch.classification),return_counts=True)
            classes.update({str(int(k)):int(v) for k,v in zip(keys,counts)})
    if classes.get("1",0)==0 or classes.get("2",0)==0:
        raise ValueError("Missing ground or unclassified surface points")
    rasters={}
    for kind in ("dtm","dsm"):
        dest=out/(kind+".tif")
        execute(pdal,raster_pipeline(points,dest,kind,bounds),out/(kind+"-pipeline.json"))
        rasters[kind]=pin_raster(dest,metric["sha256"],kind)
    with rasterio.open(out/"dtm.tif") as terrain,rasterio.open(out/"dsm.tif") as surface:
        if terrain.transform!=surface.transform or terrain.shape!=surface.shape or terrain.crs!=surface.crs:
            raise ValueError("Raster lattices differ")
        ndsm=normalized_height(surface.read(1,masked=True),terrain.read(1,masked=True))
        profile=terrain.profile.copy()
        profile.update(crs="EPSG:2793",nodata=-9999)
        with rasterio.open(out/"ndsm.tif","w",**profile) as dst:
            dst.write(ndsm.filled(-9999).astype("float32"),1)
            dst.set_band_unit(1,"m")
            dst.update_tags(TSM_Z_TYPE="RELATIVE_ABOVE_GROUND",TSM_POINT_SHA256=metric["sha256"])
        rasters["ndsm"]={"sha256":digest(out/"ndsm.tif"),"unit":"m","vertical_type":"RELATIVE_ABOVE_GROUND","valid_count":int(ndsm.count())}
    preprocess={"schema":"tsm.pdal-reconstruction-review.v1","baseline":audit,"source_metadata_url":METADATA,
        "source_metadata_sha256":meta_sha,"source_tiles":sources,"metric_points":metric,
        "classification_counts":dict(classes),"rasters":rasters,"footprints_sha256":digest(gpkg),
        "operation":"EPSG:2968+6360 to EPSG:2793+5703, source datum preserved; nominal footprint projection",
        "point_class_1_is_unclassified":True,"engineering_eligible":False,"publication_eligible":False}
    write_json(out/"preprocessing-receipt.json",preprocess)
    # Derived raster review: use actual locally generated raster grid, report
    # coverage and p90 candidates only; no promotion or substitution for roof evidence.
    from rasterio.features import geometry_mask
    from rasterio.windows import from_bounds,Window
    gaps=set(receipt["unavailable_ids"])
    base={f["id"]:f["properties"]["lidarGroundElevM"] for f in json.loads(read_local(review/"candidate/source-bound-height-candidates.geojson"))["features"]}
    rows=[]
    with rasterio.open(out/"dtm.tif") as dtm,rasterio.open(out/"ndsm.tif") as n:
        for sid,item in originals.items():
            g=item["geometry"]
            if sid in gaps:
                win=from_bounds(*g.bounds,transform=n.transform).round_offsets().round_lengths()
                try:
                    win=win.intersection(Window(0,0,n.width,n.height))
                except rasterio.errors.WindowError:
                    rows.append({"tsm_id":sid,"status":"NO_RASTER_COVERAGE"});continue
                if win.width<1 or win.height<1:
                    rows.append({"tsm_id":sid,"status":"NO_RASTER_COVERAGE"});continue
                a=n.read(1,window=win,masked=True)
                inside=geometry_mask([mapping(g)],out_shape=a.shape,transform=n.window_transform(win),invert=True)
                vals=np.asarray(a.data)[inside & ~np.ma.getmaskarray(a)]
                vals=vals[np.isfinite(vals)]
                if len(vals)>=4 and len(vals)>=0.7*np.count_nonzero(inside):
                    p90=float(np.percentile(vals,90))
                    rows.append({"tsm_id":sid,"status":"RASTER_REVIEW_CANDIDATE" if 0<p90<=100 else "INVALID_HEIGHT",
                        "p90_m":p90,"count":len(vals),"engineering_eligible":False})
                else:
                    rows.append({"tsm_id":sid,"status":"INSUFFICIENT_RASTER_COVERAGE"})
            else:
                polys=list(g.geoms) if g.geom_type=="MultiPolygon" else [g]
                coords=[xy for poly in polys for ring in (poly.exterior,*poly.interiors) for xy in list(ring.coords)[:-1]]
                vals=[float(v[0]) for v in dtm.sample(coords,masked=True) if not np.ma.is_masked(v[0]) and np.isfinite(v[0])]
                delta=[v-base[sid] for v in vals]
                rows.append({"tsm_id":sid,"status":"INCOMPLETE" if len(vals)!=len(coords) else
                    "CONTACT_MISMATCH" if max(map(abs,delta),default=0)>0.5 else "CONTACT_WITHIN_SCREENING_TOLERANCE",
                    "sample_count":len(vals),"expected":len(coords),"max_abs_delta_m":max(map(abs,delta),default=None)})
    write_json(out/"raster-diagnostics.json",{"records":rows,"status_counts":dict(Counter(r["status"] for r in rows)),
        "independent_checkpoint_validation":False,"engineering_eligible":False,"publication_eligible":False})
    roofdir=out/"roofer-output";roofdir.mkdir()
    subprocess.run([roofer,"--id-attribute","tsm_id","--bld-class","1","--grnd-class","2","--lod22",
        "--clear-insufficient","--no-simplify",str(points),str(gpkg),str(roofdir)],check=True)
    roofreview=model_review(roofdir,originals)
    roofreview.update(schema="tsm.roofer-source-linked-review.v1",scene_sha256=PINNED_SCENE,
        preprocessing_receipt_sha256=digest(out/"preprocessing-receipt.json"),
        classification="UNCLASSIFIED_CLASS_1_EXPERIMENTAL",engineering_eligible=False,publication_eligible=False,
        limitations=["Structural shell and projected roof checks only, not full solid validity or independent roof survey.",
            "Roofer class 1 candidates may include vegetation. No class 6 promotion.",
            "No actual decoded GLB terrain contact, independent checkpoints or temporal reconciliation."])
    write_json(out/"roof-review.json",roofreview)
    print(json.dumps({"raster_status":dict(Counter(r["status"] for r in rows)),"roof_status":roofreview["status_counts"]}))
    if not roofreview["file_sha256"] or not roofreview["status_counts"].get("LOD22_STRUCTURAL_REVIEW_CANDIDATE"):
        raise SystemExit("BLOCKED: no accepted structural LoD2.2 review candidates")

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("review",type=Path);p.add_argument("out",type=Path)
    p.add_argument("--pdal",required=True);p.add_argument("--ogr2ogr",required=True)
    p.add_argument("--roofer",required=True)
    a=p.parse_args()
    run(a.review,a.out,a.pdal,a.ogr2ogr,a.roofer)

if __name__=="__main__":
    main()
