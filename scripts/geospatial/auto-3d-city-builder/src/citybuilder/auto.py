"""Headless city build coordinator: bounded public GIS acquisition + visual-only massing.

Explicitly does not make hydraulic, geodetic, or regulatory determinations.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import shutil
import sys
import urllib.parse
import urllib.request
from urllib.parse import urlsplit
from pyproj import CRS, Transformer
from shapely.geometry import shape, mapping
from shapely.ops import transform as geom_transform

from citybuilder.cli import build

ALLOWED_GIS_HOSTS = {"gisdata.in.gov"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp"}


def jsonwrite(path: Path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def sha(path: Path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def public_arcgis_endpoint(base_url: str):
    parts = urlsplit(base_url)
    if (parts.scheme != "https" or parts.hostname not in ALLOWED_GIS_HOSTS or parts.username
            or parts.password or parts.port not in (None, 443) or parts.query or parts.fragment
            or not parts.path.endswith(tuple(f"/{i}" for i in range(10)))):
        raise ValueError("Use HTTPS public, explicitly allowlisted ArcGIS FeatureServer layer URL")
    if "/FeatureServer/" not in parts.path:
        raise ValueError("Use HTTPS public FeatureServer layer URL")
    return base_url.rstrip("/") + "/query"


def validate_bbox(bbox):
    if len(bbox) != 4 or any(isinstance(x,bool) or not isinstance(x,(int,float)) or not math.isfinite(x) for x in bbox):
        raise ValueError("bounding box must be four finite WGS84 numbers")
    west,south,east,north = bbox
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise ValueError("bounding box invalid")
    if (east-west) > 0.5 or (north-south) > 0.5:
        raise ValueError("bounding box too large for city-scale acquisition")


def acquire_arcgis_layer(layer_url, bbox, output_path, target_crs, *, fetch_json=None,
                         page_size=250, max_records=50000):
    """Fetch bounded polygon GeoJSON pages with stable object IDs and local receipt.

    Data is geographic WGS84 and reprojected to a metre-axis target CRS.
    Rejects skipped/duplicate pages and incomplete results; does not overwrite on failure.
    """
    query_url = public_arcgis_endpoint(layer_url)
    validate_bbox(bbox)
    if not isinstance(page_size,int) or not 1 <= page_size <= 2000 or not isinstance(max_records,int) or not 1 <= max_records <= 200000:
        raise ValueError("page_size/max_records outside bounded limits")
    crs = CRS.from_user_input(target_crs)
    if crs.is_geographic or any(abs(a.unit_conversion_factor - 1) > 1e-8 for a in crs.axis_info[:2]):
        raise ValueError("target CRS must be projected in metres")
    projector = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    if fetch_json is None:
        def fetch_json(url, params):
            encoded = urllib.parse.urlencode(params)
            req = urllib.request.Request(url+"?"+encoded, headers={"User-Agent":"Auto3DCityBuilder/0.2 (+public GIS evidence)","Accept":"application/geo+json,application/json"})
            with urllib.request.urlopen(req, timeout=35) as response:
                if response.url.split('/')[2] != urlsplit(layer_url).netloc:
                    raise ValueError("unexpected GIS redirect origin")
                data = response.read(15_000_001)
                if len(data)>15_000_000:
                    raise ValueError("GIS page exceeds 15 MB budget")
                return json.loads(data)
    result, seen, pages = [], set(), []
    west,south,east,north = bbox
    for offset in range(0,max_records,page_size):
        params = {"where":"1=1", "geometry":f"{west},{south},{east},{north}",
                  "geometryType":"esriGeometryEnvelope", "inSR":"4326", "spatialRel":"esriSpatialRelIntersects",
                  "outFields":"*", "returnGeometry":"true", "outSR":"4326", "f":"geojson",
                  "resultOffset":offset,"resultRecordCount":min(page_size,max_records-offset)}
        data = fetch_json(query_url,params)
        if data.get("error"):
            raise ValueError(f"ArcGIS service error: {str(data['error'])[:200]}")
        features = data.get("features")
        if data.get("type")!="FeatureCollection" or not isinstance(features,list):
            raise ValueError("ArcGIS did not supply GeoJSON FeatureCollection")
        if not features:
            break
        pages.append({"offset":offset,"count":len(features),"fingerprint":hashlib.sha256(json.dumps(features,sort_keys=True).encode()).hexdigest()})
        for f in features:
            props = f.get("properties") or {}
            rid = next((props[k] for k in ("OBJECTID","objectid","ObjectId","FID","fid") if k in props and props[k] is not None), f.get("id"))
            if rid is None:
                raise ValueError("ArcGIS building missing stable ID")
            sid = f"arcgis:{rid}"
            if sid in seen:
                raise ValueError("Duplicate source ID across pages")
            seen.add(sid)
            geom = shape(f["geometry"])
            if geom.is_empty or not geom.is_valid or geom.geom_type not in ("Polygon","MultiPolygon"):
                raise ValueError("Invalid geometry in source record")
            projected = geom_transform(projector.transform,geom)
            props = {**props,"source_id":sid,"source_url":layer_url,"source_status":"OFFICIAL_GEOMETRY_UNREVIEWED"}
            result.append({"type":"Feature","properties":props,"geometry":mapping(projected)})
        if len(features)<page_size:
            break
    else:
        raise ValueError("max_records reached without source exhaustion; increase explicitly after review")
    if not result:
        raise ValueError("ArcGIS returned no buildings within the requested city AOI")
    output_path=Path(output_path)
    fc={"type":"FeatureCollection","features":result}
    jsonwrite(output_path,fc)
    receipt={"source_url":layer_url,"bbox_wgs84":bbox,"input_crs":"EPSG:4326","output_crs":target_crs,
             "count":len(result),"pages":pages,"sha256":sha(output_path),
             "retrieved_utc":datetime.now(timezone.utc).isoformat(),"verification":"SOURCE_GEOMETRY_NOT_INDEPENDENTLY_VALIDATED"}
    jsonwrite(output_path.with_name(output_path.stem+".receipt.json"),receipt)
    return receipt


def design_nerf_job(images_dir, output_dir, *, execute=False):
    """Produce checkable NeRF / Gaussian-splat plan without fake training claims.

    Execution requires an explicit GPU environment and externally installed tools.
    """
    images_dir, output_dir=Path(images_dir),Path(output_dir)
    images=sorted(p for p in images_dir.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS) if images_dir.is_dir() else []
    status="READY_FOR_CAPTURE_QA" if len(images)>=3 else "BLOCKED_INPUT_MISSING"
    data_dir=output_dir/"processed"
    cmds=[ ["ns-process-data","images","--data",str(images_dir),"--output-dir",str(data_dir)],
           ["ns-train","splatfacto","--data",str(data_dir),"--output-dir",str(output_dir/"training")],
           ["ns-train","nerfacto","--data",str(data_dir),"--output-dir",str(output_dir/"training")]]
    report={"status":status,"executed":False,"image_count":len(images),"image_sha256":{p.name:sha(p) for p in images},
            "suggested_commands":cmds,"requirements":["overlapping sharp rights-cleared photos","COLMAP camera pose recovery or surveyed poses","NVIDIA CUDA GPU and tested Nerfstudio environment","GCP/scene-to-map anchor verification","independent splat format/renderer compatibility gate"],
            "published_asset":None,"provenance_class":"DERIVED_VISUAL_NOT_SURVEY"}
    if execute:
        raise ValueError("GPU jobs require an independently configured worker; no implicit shell execution")
    jsonwrite(output_dir/"neural_reconstruction_job.json",report)
    return report


def run_city_build(profile_path, output_dir, *, offline=True, estimate_missing=True, acquire=False, neural_images=None):
    profile_path=Path(profile_path).resolve()
    profile=json.loads(profile_path.read_text(encoding="utf-8"))
    if not isinstance(profile.get("center"),list) or len(profile["center"])!=2:
        raise ValueError("City center [lon,lat] is required")
    lon,lat=profile["center"]
    if not (-180<=lon<=180 and -90<=lat<=90):
        raise ValueError("Invalid city center")
    output_dir=Path(output_dir).resolve()
    snapshot=profile.get("source_snapshot")
    if acquire and not offline:
        registry=[s for s in profile.get("source_registry",[]) if s.get("layer")=="buildings" and s.get("kind")=="arcgis"]
        if not registry:
            raise ValueError("No official building source registered")
        target=output_dir/"inputs"/"buildings_projected.geojson"
        source=registry[0]
        receipt=acquire_arcgis_layer(source["url"],profile["aoi_bbox_wgs84"],target,profile["crs"],max_records=profile.get("max_buildings",50000))
        snapshot=target
        status_source={"type":"LIVE_ARCGIS_SNAPSHOT","receipt":receipt}
    else:
        if not snapshot:
            raise ValueError("A local source snapshot is required in offline mode")
        snapshot=(profile_path.parent/snapshot).resolve() if not Path(snapshot).is_absolute() else Path(snapshot)
        if not snapshot.is_file():
            raise ValueError(f"Local source snapshot missing: {snapshot}")
        status_source={"type":"LOCAL_VERIFIABLE_SNAPSHOT","path":str(snapshot),"sha256":sha(snapshot)}
    manifest=build(snapshot,output_dir,profile["crs"],"m",profile.get("vertical_datum","UNVERIFIED_VISUAL"),"m",
                   source_url=status_source.get("receipt",{}).get("source_url",profile.get("source_url","")),
                   source_date=profile.get("source_date",""),estimate_missing=estimate_missing)
    viewer=Path(__file__).resolve().parents[2]/"viewer"/"index.html"
    shutil.copyfile(viewer,output_dir/"index.html")
    # The 4th dimension is an evidence-classified event timeline, not a pretend
    # change in geometry or a hydrodynamic prediction. Only explicitly supplied
    # events are emitted, with stable IDs and declared source/quality.
    events=[]
    for event in profile.get("timeline_events",[]):
        if event.get("status") not in ("SIMULATED", "HISTORICAL_UNVERIFIED", "OBSERVED"):
            raise ValueError("Timeline event requires declared evidence status")
        if event["status"] == "OBSERVED" and not all(event.get(k) for k in ("source_url","observation_utc","evidence_sha256")):
            raise ValueError("OBSERVED event requires provenance, timestamp and digest")
        dt=event.get("timestamp_utc")
        if not isinstance(dt,str) or not dt.endswith("Z"):
            raise ValueError("Timeline timestamp must be ISO-8601 UTC with Z")
        datetime.fromisoformat(dt.replace("Z","+00:00"))
        if not isinstance(event.get("event_id"),str) or not event["event_id"]:
            raise ValueError("Timeline event_id required")
        events.append(event)
    if len({e["event_id"] for e in events})!=len(events):
        raise ValueError("Duplicate timeline event_id")
    jsonwrite(output_dir/"timeline_events.json",{"schema_version":"1.0.0","events":sorted(events,key=lambda e:e["timestamp_utc"]),"note":"Changes of scenario labels only; no inferred terrain deformation or hydraulic physics"})
    if neural_images is not None:
        design_nerf_job(neural_images,output_dir/"neural")
    receipt={"schema_version":"0.2.1","status":"BUILT_WITH_EVIDENCE_REVIEW","city":profile["name"],
             "camera_center_lonlat":profile["center"],"camera_center_role":"Approximate orientation only; not model anchor",
             "source":status_source,"features_built":manifest["features_built"],
             "estimates":manifest["estimate_count"],"data_safety":"VISUAL_ONLY_NOT_FOR_SAFETY_OR_REGULATION",
             "output_files":["index.html","buildings.glb","tileset.json","manifest.json","estimate_ledger.json","timeline_events.json"],"timeline_events":len(events),
             "build_sha256":hashlib.sha256(json.dumps({"input":manifest["input_sha256"],"outputs":manifest["output_hashes"],"city":profile["name"]},sort_keys=True).encode()).hexdigest()}
    jsonwrite(output_dir/"build_report.json",receipt)
    return receipt


def main(argv=None):
    parser=argparse.ArgumentParser(description="Build evidence-labelled city model from official or local source snapshot")
    parser.add_argument("profile",type=Path)
    parser.add_argument("output",type=Path)
    parser.add_argument("--online-acquire",action="store_true",help="Fetch bounded IGIO ArcGIS footprints; opt-in network")
    parser.add_argument("--strict",action="store_true",help="Require real heights; reject estimated world massing")
    parser.add_argument("--neural-images",type=Path,help="Write NeRF/3DGS job receipt; DOES NOT execute GPU training")
    args=parser.parse_args(argv)
    try:
        result=run_city_build(args.profile,args.output,offline=not args.online_acquire,
                              estimate_missing=not args.strict,acquire=args.online_acquire,neural_images=args.neural_images)
        print(json.dumps(result,indent=2))
        return 0
    except (ValueError,KeyError,TypeError) as e:
        print("BUILD FAILED:",e,file=sys.stderr)
        return 2

if __name__=="__main__":
    raise SystemExit(main())
