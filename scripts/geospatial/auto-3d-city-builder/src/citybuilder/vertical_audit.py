"""Independent post-build integrity audit, never engineering/publication approval."""
import argparse
import json
import re
import struct
from pathlib import Path

from citybuilder.tsm_adapter import sha, read_local

def verify(root):
    root=Path(root)
    candidate=root/"candidate"
    tiles=candidate/"tiles"
    if any(p.is_symlink() or not p.is_dir() for p in (root,root/"source",candidate,tiles)):
        raise ValueError("Missing or symlinked review directories")
    raw=read_local(root/"source/scene.json")
    source=json.loads(raw)
    source_receipt=json.loads(read_local(root/"source/scene.receipt.json"))
    receipt_raw=read_local(candidate/"vertical-reconstruction-receipt.json")
    r=json.loads(receipt_raw)
    if (source_receipt.get("sha256")!=sha(raw) or source_receipt.get("byte_length")!=len(raw)
            or r.get("scene_sha256")!=sha(raw)):
        raise ValueError("Source digest mismatch")
    if (r.get("schema")!="tsm.vertical-reconstruction-candidate.v1"
            or r.get("status")!="NOMINAL_PLACEMENT_CANDIDATE_BUILT"
            or r.get("engineering_eligible") is not False or r.get("publication_eligible") is not False
            or r.get("terrain_checkpoints")!="NOT_VALIDATED"):
        raise ValueError("Candidate authority boundary invalid")
    metadata={"COPC_HEADER_EPSG_2968_6360":"copc-receipt.json",
              "EPT_DECLARED_EPSG_5703":"ept.json"}.get(r.get("source_evidence_kind"))
    if not metadata:
        raise ValueError("Unknown vertical source")
    for path,key in ((root/"lidar.geojson","lidar_sha256"),(root/metadata,"source_metadata_sha256"),
                     (candidate/"source-bound-height-candidates.geojson","candidate_geojson_sha256"),
                     (tiles/"tileset.json","tileset_sha256")):
        if sha(read_local(path))!=r.get(key):
            raise ValueError("Candidate digest mismatch: "+path.name)
    originals=source["buildings"]["features"]
    original_by_id={f["id"]:f for f in originals}
    derived=json.loads(read_local(candidate/"source-bound-height-candidates.geojson"))["features"]
    by_id={f["id"]:f for f in derived}
    missing=r.get("unavailable_ids")
    if (not isinstance(missing,list) or len(missing)!=len(set(missing))
            or len(original_by_id)!=len(originals) or len(by_id)!=len(derived)
            or set(by_id)&set(missing) or set(by_id)|set(missing)!=set(original_by_id)
            or r.get("source_count")!=len(originals) or r.get("accepted_count")!=len(derived)
            or source_receipt["feature_counts"]["buildings"]!=len(originals)):
        raise ValueError("Candidate identity partition mismatch")
    for sid,f in by_id.items():
        props=f["properties"]
        if (not re.fullmatch(r"IGIO:building:[0-9]+",sid) or props.get("igioObjectId")!=int(sid.split(":")[-1])
                or f["geometry"]!=original_by_id[sid]["geometry"]
                or props.get("source_feature_sha256")!=original_by_id[sid]["properties"]["source_feature_sha256"]):
            raise ValueError("Candidate identity or geometry mismatch")
        if (props.get("heightProvenance")!="DERIVED" or props.get("lidarHeightStatus")!="OK"
                or props.get("groundElevationDatum")!="NAVD88" or props.get("geoidModel")!="GEOID18"
                or props.get("engineering_approved") is not False):
            raise ValueError("Candidate authority or vertical provenance mismatch")
    tileset=json.loads(read_local(tiles/"tileset.json"))
    manifest=json.loads(read_local(tiles/"manifest.json"))
    info=manifest["input"]
    if (info.get("geojsonSha256")!=r["candidate_geojson_sha256"]
            or info.get("explicitScreeningEstimateCount")!=0
            or info.get("geoidDeclaredCount")!=len(by_id)
            or manifest.get("engineeringUse") is not False or manifest.get("regulatoryUse") is not False):
        raise ValueError("Tile manifest authority or source mismatch")
    children=tileset["root"]["children"]
    ids=[]
    expected={"tileset.json","manifest.json"}
    for child in children:
        props=child["extras"]["tsm"]
        oid=props.get("sourceObjectId")
        uri=child["content"]["uri"]
        if type(oid) is not int or uri!=f"{oid}.glb":
            raise ValueError("Tile identity mismatch")
        if (props.get("heightProvenance")!="DERIVED"
                or props.get("verticalPlacementStatus")!="SOURCE_DECLARED_GEOID18_VISUAL_ONLY"):
            raise ValueError("Tile authority or placement mismatch")
        ids.append(f"IGIO:building:{oid}")
        expected.add(uri)
    if len(ids)!=len(set(ids)) or set(ids)!=set(by_id):
        raise ValueError("Tile identity coverage mismatch")
    checksums={}
    for line in read_local(tiles/"SHA256SUMS").decode().splitlines():
        match=re.fullmatch(r"([0-9a-f]{64})  ([A-Za-z0-9_.-]+)",line)
        if not match or match[2] in checksums:
            raise ValueError("Invalid tile checksum inventory")
        checksums[match[2]]=match[1]
    if set(checksums)!=expected or {p.name for p in tiles.glob("*.glb")}!=expected-{"tileset.json","manifest.json"}:
        raise ValueError("Tile checksum inventory mismatch")
    for name,digest in checksums.items():
        data=read_local(tiles/name)
        if sha(data)!=digest:
            raise ValueError("Tile digest mismatch: "+name)
        if name.endswith(".glb") and (len(data)<20 or struct.unpack_from("<4sII",data)!=(b"glTF",2,len(data))):
            raise ValueError("Invalid GLB header")
    return {"schema":"tsm.vertical-candidate-audit.v1","status":"CANDIDATE_INTEGRITY_PASS",
            "source_count":len(originals),"candidate_count":len(by_id),"unavailable_count":len(missing),
            "complete_candidate_coverage":not missing,"source_sha256":sha(raw),
            "receipt_sha256":sha(receipt_raw),"tile_inventory_sha256":sha(read_local(tiles/"SHA256SUMS")),
            "raw_source_headers_rechecked":False,"terrain_checkpoints":"NOT_VALIDATED",
            "engineering_eligible":False,"publication_eligible":False}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("artifact",type=Path)
    args=p.parse_args()
    print(json.dumps(verify(args.artifact),indent=2))

if __name__=="__main__":
    main()
