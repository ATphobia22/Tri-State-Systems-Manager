#!/usr/bin/env python3
"""Build a deterministic offline Posey parcel layer from the IGIO downloader output.

Requires pyproj. EPSG:2966 is a horizontal CRS only: no vertical conversion is implied.
"""
import argparse
import hashlib
import json
from pathlib import Path
from pyproj import Transformer

def convert_geometry(geometry, transformer):
    def walk(coords):
        if isinstance(coords[0], (float, int)):
            x, y = transformer.transform(coords[0], coords[1])
            if not (-1e8 < x < 1e8 and -1e8 < y < 1e8):
                raise ValueError("Invalid transformed coordinate")
            return [x, y, *coords[2:]]
        return [walk(c) for c in coords]
    if geometry is None:
        raise ValueError("Null parcel geometry")
    return {"type": geometry["type"], "coordinates": walk(geometry["coordinates"])}

def build(source, output):
    manifest = json.loads((source/"manifest.json").read_text())
    if manifest.get("source_crs") != "EPSG:4326" or manifest.get("where") != "county_fips='18129'":
        raise ValueError("Unexpected source CRS or county filter")
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:2966", always_xy=True, allow_ballpark=False)
    output.mkdir(parents=True, exist_ok=True)
    index = {"schema_version":"1.0.0","layer":"posey_parcels_2025","source_crs":"EPSG:4326","target_crs":"EPSG:2966","format":"TSM_PROJECTED_FEATURE_COLLECTION_V1","vertical_datum":"NOT_APPLICABLE","source":manifest["source"],"batches":[],"total_features":0,"status":"OFFLINE_PARCEL_GEOMETRY_NOT_SURVEY_CERTIFIED"}
    seen=set()
    for item in manifest["batches"]:
        filename = Path(item["file"]).name
        raw=(source/filename).read_bytes()
        if hashlib.sha256(raw).hexdigest() != item["sha256"]:
            raise ValueError("SHA-256 mismatch: "+filename)
        data=json.loads(raw)
        features=[]
        for feature in data["features"]:
            properties=feature["properties"]
            if str(properties.get("county_fips")) != "18129":
                raise ValueError("Out-of-county parcel")
            oid=properties.get("objectid", properties.get("OBJECTID"))
            if oid is None or oid in seen:
                raise ValueError("Missing or duplicate parcel objectid")
            seen.add(oid)
            features.append({"type":"Feature","id":oid,"properties":properties,"geometry":convert_geometry(feature["geometry"],transformer)})
        if len(features) != item["features"]:
            raise ValueError("Feature count mismatch")
        target=filename.replace(".geojson",".epsg2966.json")
        payload=(json.dumps({"type":"FeatureCollection","features":features},separators=(",",":"))+"\n").encode()
        (output/target).write_bytes(payload)
        index["batches"].append({"file":target,"features":len(features),"sha256":hashlib.sha256(payload).hexdigest()})
        index["total_features"]+=len(features)
    if index["total_features"] != manifest["feature_count_expected"]:
        raise ValueError("Source feature count mismatch")
    (output/"layer-manifest.json").write_text(json.dumps(index,indent=2)+"\n")
    return index

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--source",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    result=build(args.source,args.output)
    print(f"Built {result['total_features']} EPSG:2966 parcel features")
