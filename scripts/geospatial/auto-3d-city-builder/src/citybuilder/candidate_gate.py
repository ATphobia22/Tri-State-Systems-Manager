"""Independent byte, identity and authority gate for TSM visual candidates.

This is not a geometric, terrain, licensing or publication acceptance gate.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct

def digest(raw):
    return hashlib.sha256(raw).hexdigest()

def local(root, name):
    if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9_.-]+", name) or name in {".", ".."}:
        raise ValueError("Unsafe candidate file name")
    path = root/name
    if path.is_symlink() or not path.is_file():
        raise ValueError("Missing or symlinked candidate input")
    return path.read_bytes()

def verify(scene_dir, candidate_dir):
    source, root = Path(scene_dir), Path(candidate_dir)
    if source.is_symlink() or root.is_symlink():
        raise ValueError("Symlinked root")
    scene_raw = local(source, "scene.json")
    source_receipt_raw = local(source, "scene.receipt.json")
    source_receipt = json.loads(source_receipt_raw)
    receipt_raw = local(root, "tsm-reconstruction-receipt.json")
    receipt = json.loads(receipt_raw)
    if (receipt.get("schema") != "tsm.reconstruction-candidate.v1"
            or receipt.get("status") != "VISUAL_CANDIDATE_ONLY"
            or receipt.get("publication_eligible") is not False
            or receipt.get("engineering_eligible") is not False
            or receipt.get("terrain_alignment") != "NOT_VALIDATED"):
        raise ValueError("Candidate authority boundary invalid")
    if (source_receipt.get("sha256") != digest(scene_raw)
            or source_receipt.get("byte_length") != len(scene_raw)
            or receipt.get("input_scene_sha256") != digest(scene_raw)
            or receipt.get("input_receipt_sha256") != digest(source_receipt_raw)):
        raise ValueError("Source digest mismatch")
    scene = json.loads(scene_raw)
    ids = [f["id"] for f in scene["buildings"]["features"]]
    if (len(ids) != len(set(ids)) or sorted(ids) != receipt.get("source_ids")
            or len(ids) != receipt.get("features_built")):
        raise ValueError("Source identity mismatch")
    hashes = receipt["output_sha256"]
    required = {"manifest.json", "projected-footprints.geojson", "buildings.glb",
                "tileset.json", "estimate_ledger.json"}
    if not required.issubset(hashes):
        raise ValueError("Required candidate digest missing")
    for name, expected in hashes.items():
        raw = local(root, name)
        if digest(raw) != expected:
            raise ValueError("Candidate digest mismatch: " + name)
        if name.endswith(".glb"):
            if len(raw) < 20 or struct.unpack_from("<4sII", raw) != (b"glTF", 2, len(raw)):
                raise ValueError("Invalid GLB header: " + name)
        if name.startswith("tileset") and name.endswith(".json"):
            doc = json.loads(raw)
            uri = doc["root"]["content"]["uri"]
            if doc["asset"]["version"] != "1.1" or uri not in hashes or not uri.endswith(".glb"):
                raise ValueError("Invalid tileset content binding")
    manifest = json.loads(local(root, "manifest.json"))
    ledger = json.loads(local(root, "estimate_ledger.json"))
    projected = json.loads(local(root, "projected-footprints.geojson"))
    expected_hashes = {f["id"]: f["properties"]["source_feature_sha256"] for f in scene["buildings"]["features"]}
    projected_hashes = {f["id"]: f["properties"]["source_feature_sha256"] for f in projected["features"]}
    if (expected_hashes != projected_hashes or len(projected["features"]) != len(ids)
            or sorted(o["source_id"] for o in manifest["objects"]) != sorted(ids)):
        raise ValueError("Projected identity mismatch")
    if (manifest.get("geometry_use") != "VISUAL_ONLY" or ledger.get("engineering_eligibility") is not False
            or manifest.get("input_sha256") != hashes["projected-footprints.geojson"]
            or manifest.get("estimate_count") != len(ledger["estimates"])
            or receipt.get("estimate_count") != len(ledger["estimates"])
            or any(x.get("allowed_use") != "VISUAL_ONLY_NOT_ENGINEERING" or x.get("source_id") not in expected_hashes for x in ledger["estimates"])):
        raise ValueError("Candidate authority or estimate ledger mismatch")
    if any(hashes.get(k) != v for k,v in manifest["output_hashes"].items()):
        raise ValueError("Manifest digest mismatch")
    return {"schema": "tsm.reconstruction-integrity.v1", "status": "VISUAL_CANDIDATE_INTEGRITY_PASS",
            "feature_count": len(ids), "estimate_count": len(ledger["estimates"]),
            "receipt_sha256": digest(receipt_raw), "scene_sha256": digest(scene_raw),
            "publication_eligible": False, "engineering_eligible": False, "terrain_alignment": "NOT_VALIDATED"}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("scene", type=Path)
    p.add_argument("candidate", type=Path)
    args = p.parse_args()
    print(json.dumps(verify(args.scene, args.candidate), indent=2))

if __name__ == "__main__":
    main()
