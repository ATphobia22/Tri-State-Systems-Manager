#!/usr/bin/env python3
"""Download Posey County's 2025 IGIO parcels in bounded, auditable batches."""
import argparse
import hashlib
import json
import pathlib
import time
import urllib.parse
import urllib.request

SERVICE = "https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0"
WHERE = "county_fips='18129'"

def request(path, params):
    url = SERVICE + path + "?" + urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent":"TSM-Posey-DataHarvest/1.0"}), timeout=60) as response:
                obj = json.load(response)
            if "error" in obj:
                raise RuntimeError(str(obj["error"]))
            return obj
        except (OSError, ValueError) as exc:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError("unreachable")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument("--batch-size", type=int, default=500)
    args = parser.parse_args()
    if not 1 <= args.batch_size <= 2000:
        parser.error("batch-size must be 1..2000")
    args.output.mkdir(parents=True, exist_ok=True)
    metadata = request("", {"f":"json"})
    if metadata.get("objectIdField") != "objectid" or metadata.get("spatialReference",{}).get("wkid") != 4326:
        raise RuntimeError("Unexpected source schema/CRS; stop for review")
    ids_response = request("/query", {"f":"json","where":WHERE,"returnIdsOnly":"true"})
    ids = sorted(ids_response.get("objectIds") or [])
    if not ids:
        raise RuntimeError("No Posey records returned; verify county_fips and service")
    manifest = {"source":SERVICE,"where":WHERE,"source_crs":"EPSG:4326","feature_count_expected":len(ids),"batches":[],"verification":"SOURCE_DOWNLOADED_NOT_SURVEY_CERTIFIED"}
    all_ids = set()
    for offset in range(0,len(ids),args.batch_size):
        subset = ids[offset:offset+args.batch_size]
        response = request("/query",{"f":"geojson","objectIds":",".join(map(str,subset)),"outFields":"*","outSR":"4326","returnGeometry":"true"})
        features = response.get("features",[])
        returned = {f.get("properties",{}).get("objectid") for f in features}
        if len(features) != len(subset) or returned != set(subset) or all_ids.intersection(returned):
            raise RuntimeError("Missing/duplicate/mismatched feature IDs; abort")
        all_ids.update(returned)
        blob = (json.dumps(response,separators=(",",":"),ensure_ascii=False)+"\n").encode()
        name = f"posey_parcels_2025_{offset//args.batch_size:05d}.geojson"
        (args.output/name).write_bytes(blob)
        manifest["batches"].append({"file":name,"features":len(features),"sha256":hashlib.sha256(blob).hexdigest()})
    if all_ids != set(ids):
        raise RuntimeError("Final feature reconciliation failed")
    (args.output/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print(f"Downloaded {len(ids)} parcel features in {len(manifest['batches'])} verified batches")

if __name__ == "__main__":
    main()
