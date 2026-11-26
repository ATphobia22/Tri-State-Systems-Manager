"""Bridge independently supplied, source-bound LiDAR extraction to TSM's LoD1 tiler.

Visual candidate only: declared NAVD88 and GEOID18 are not independent
terrain/checkpoint acceptance or a full reference-frame realization.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import sys
from pyproj import Transformer
from shapely.geometry import shape
from citybuilder.tsm_adapter import read_local, sha

FTUS = 1200 / 3937
GEO = Path(__file__).resolve().parents[3]
# Installed editable from the canonical TSM checkout; scripts are not duplicated.
def finite(x):
    return type(x) in (int,float) and math.isfinite(x)

def prepare(scene, lidar, sample_geoid):
    if scene.get("schema") != "tsm.mount-vernon-city-scene.v1" or scene.get("crs") != "EPSG:4326":
        raise ValueError("Unsupported source scene")
    if lidar.get("type") != "FeatureCollection":
        raise ValueError("Expected LiDAR FeatureCollection")
    originals = {}
    for f in scene["buildings"]["features"]:
        sid = f["id"]
        if sid in originals or not re.fullmatch(r"IGIO:building:[0-9]+", sid):
            raise ValueError("Invalid source identity")
        originals[sid] = f
    output, seen, missing = [], set(), []
    for f in lidar["features"]:
        sid = f["id"]
        if sid not in originals or sid in seen:
            raise ValueError("LiDAR source identity mismatch")
        seen.add(sid)
        original = originals[sid]
        props = f["properties"]
        if (props.get("tsm_id") != sid or props.get("source_feature_sha256") != original["properties"]["source_feature_sha256"]
                or f["geometry"] != original["geometry"]):
            raise ValueError("LiDAR source geometry or identity hash mismatch")
        ground, roof, h = (props.get(k) for k in ("lidarGroundElevM","lidarRoofElevM","lidarHeightM"))
        if (props.get("lidarHeightStatus") != "OK" or props.get("lidarHeightDatum") != "NAVD88"
                or props.get("lidarHeightUnit") != "ftUS" or not all(finite(v) for v in (ground,roof,h))
                or not 0 < h <= 99.9 or abs(roof-ground-h) > .03
                or type(props.get("lidarRoofPoints")) is not int or props["lidarRoofPoints"] < 5
                or type(props.get("lidarGroundPoints")) is not int or props["lidarGroundPoints"] < 3
                or not props.get("lidarHeightMethod") or not props.get("lidarSource")):
            missing.append(sid)
            continue
        geometry = shape(original["geometry"])
        if not geometry.is_valid or geometry.is_empty or geometry.geom_type not in ("Polygon","MultiPolygon"):
            raise ValueError("Invalid footprint geometry")
        centroid = geometry.centroid
        n = sample_geoid(centroid.x,centroid.y)
        if not finite(n) or not -120 <= n <= 120:
            raise ValueError("Invalid geoid separation")
        output.append({"type":"Feature","id":sid,"geometry":original["geometry"],
            "properties":{**props,"igioObjectId":int(sid.split(":")[-1]),
             "heightProvenance":"DERIVED","groundElevationFt":ground/FTUS,
             "groundElevationDatum":"NAVD88","groundElevationUnit":"ftUS","lidarHeightFt":h/FTUS,
             "geoidUndulationM":n,"geoidModel":"GEOID18","geoidHorizontalFrame":"NAD83(2011)",
             "geoidSourceUrl":"https://geodesy.noaa.gov/GEOID/GEOID18/",
             "engineering_approved":False}})
    missing.extend(set(originals)-seen)
    return {"type":"FeatureCollection","features":output}, {
        "schema":"tsm.vertical-reconstruction-candidate.v1","source_count":len(originals),
        "accepted_count":len(output),"unavailable_ids":sorted(missing),
        "engineering_eligible":False,"publication_eligible":False,
        "alignment":"NOMINAL_GEOID18_VISUAL_ONLY","terrain_checkpoints":"NOT_VALIDATED"}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("scene",type=Path)
    p.add_argument("lidar",type=Path)
    p.add_argument("output",type=Path)
    p.add_argument("--lidar-sha256",required=True)
    p.add_argument("--metadata",type=Path,required=True,help="Exact EPT metadata JSON from extraction source")
    p.add_argument("--metadata-sha256",required=True)
    p.add_argument("--grid",type=Path,required=True)
    args=p.parse_args()
    if args.output.exists() or args.output.is_symlink():
        p.error("Output already exists")
    scene_raw=read_local(args.scene/"scene.json")
    source_receipt=json.loads(read_local(args.scene/"scene.receipt.json"))
    if source_receipt.get("sha256") != sha(scene_raw) or source_receipt.get("byte_length") != len(scene_raw):
        p.error("Scene checksum mismatch")
    lidar_raw=read_local(args.lidar)
    metadata_raw=read_local(args.metadata)
    if sha(lidar_raw)!=args.lidar_sha256 or sha(metadata_raw)!=args.metadata_sha256:
        p.error("LiDAR evidence checksum mismatch")
    meta=json.loads(metadata_raw)
    srs=meta.get("srs",{})
    # The legacy extractor assumes metre-valued Z; require explicit NAVD88 metres.
    if not isinstance(srs,dict) or srs.get("authority")!="EPSG" or str(srs.get("vertical"))!="5703":
        p.error("EPT metadata does not explicitly establish EPSG:5703 NAVD88 metres")
    sys.path.insert(0,str(GEO))
    from tsm_geodesy import GeoidModel,GEOID18_GRID_SHA256
    if sha(read_local(args.grid))!=GEOID18_GRID_SHA256:
        p.error("GEOID18 grid checksum mismatch")
    grid=GeoidModel(args.grid)
    transform=Transformer.from_crs("EPSG:4326","EPSG:6318",always_xy=True)
    def sample(lon,lat):
        x,y=transform.transform(lon,lat)
        return grid.get_geoid_height(y,x)
    fc,report=prepare(json.loads(scene_raw),json.loads(lidar_raw),sample)
    report.update({"scene_sha256":sha(scene_raw),"lidar_sha256":sha(lidar_raw),"ept_metadata_sha256":sha(metadata_raw),
                   "geoid_grid_sha256":GEOID18_GRID_SHA256,
                   "horizontal_frame":"Nominal PROJ EPSG:4326 to EPSG:6318; epoch and independent checkpoints not established"})
    args.output.mkdir(parents=True,exist_ok=False)
    input_path=args.output/"source-bound-height-candidates.geojson"
    input_path.write_text(json.dumps(fc,allow_nan=False)+"\n")
    report["candidate_geojson_sha256"]=sha(input_path.read_bytes())
    if fc["features"]:
        tile_dir=args.output/"tiles"
        subprocess.run([sys.executable,str(GEO/"build-building-3d-tiles.py"),"--geojson",str(input_path),
            "--out-dir",str(tile_dir),"--expected-buildings",str(len(fc["features"])),"--require-geoid-placement"],check=True)
        subprocess.run([sys.executable,str(GEO/"validate-building-3d-tiles.py"),"--tileset",str(tile_dir/"tileset.json"),
            "--tiles-dir",str(tile_dir),"--expected-buildings",str(len(fc["features"])),"--expected-glbs",str(len(fc["features"]))],check=True)
        report["tileset_sha256"]=sha((tile_dir/"tileset.json").read_bytes())
        report["status"]="NOMINAL_PLACEMENT_CANDIDATE_BUILT"
    else:
        report["status"]="BLOCKED_NO_QUALIFYING_HEIGHTS"
    (args.output/"vertical-reconstruction-receipt.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
