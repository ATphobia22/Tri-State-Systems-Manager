#!/usr/bin/env python3
"""Strict validation for the generated TSM OGC 3D Tiles terrain artifact."""
from __future__ import annotations
import argparse, hashlib, json, struct
from pathlib import Path

def walk(node, uris):
    if not isinstance(node, dict): raise ValueError("tile node must be an object")
    volume = node.get("boundingVolume", {})
    box, sphere = volume.get("box"), volume.get("sphere")
    if box is not None:
        if not isinstance(box, list) or len(box) != 12 or not all(isinstance(v, (int, float)) for v in box):
            raise ValueError("box bounding volume must contain 12 numbers")
    elif sphere is not None:
        if not isinstance(sphere, list) or len(sphere) != 4 or not all(isinstance(v, (int, float)) for v in sphere) or sphere[3] < 0:
            raise ValueError("sphere bounding volume must contain center xyz and non-negative radius")
    else:
        raise ValueError("every tile requires a box, region, or sphere bounding volume")
    if not isinstance(node.get("geometricError"), (int, float)) or node["geometricError"] < 0:
        raise ValueError("invalid geometricError")
    content = node.get("content")
    uri = content.get("uri") if isinstance(content, dict) else None
    if uri:
        p = Path(uri)
        if p.is_absolute() or ".." in p.parts or "\\" in uri or "://" in uri or not uri.endswith(".glb"):
            raise ValueError(f"unsafe/non-GLB tile URI: {uri}")
        uris.append(uri)
    children = node.get("children", [])
    if not isinstance(children, list): raise ValueError("children must be an array")
    for child in children: walk(child, uris)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tileset", required=True, type=Path)
    args = ap.parse_args()
    root = args.tileset.parent
    tileset = json.loads(args.tileset.read_text())
    if tileset.get("asset", {}).get("version") != "1.1": raise SystemExit("asset.version must be 1.1")
    tsm = tileset.get("asset", {}).get("extras", {}).get("tsm", {})
    if tsm.get("authorityClass") != "DERIVED" or tsm.get("engineeringUse") is not False or tsm.get("regulatoryUse") is not False:
        raise SystemExit("TSM visualization authority boundary is invalid")
    uris = []
    walk(tileset["root"], uris)
    if not uris or len(uris) != len(set(uris)): raise SystemExit("tileset content URI set is empty or duplicated")
    for uri in uris:
        data = (root / uri).read_bytes()
        if data[:4] != b"glTF" or len(data) < 20 or struct.unpack("<I", data[4:8])[0] != 2 or struct.unpack("<I", data[8:12])[0] != len(data):
            raise SystemExit(f"invalid GLB container: {uri}")
        chunk_len, chunk_type = struct.unpack("<I4s", data[12:20])
        if chunk_type != b"JSON": raise SystemExit(f"missing GLB JSON chunk: {uri}")
        json.loads(data[20:20 + chunk_len].decode("utf-8"))
    expected = {}
    for line in (root / "SHA256SUMS").read_text().splitlines():
        digest, path = line.split("  ", 1)
        expected[path] = digest
    for path in [args.tileset.name, "manifest.json", *uris]:
        actual = hashlib.sha256((root / path).read_bytes()).hexdigest()
        if expected.get(path) != actual: raise SystemExit(f"SHA-256 mismatch/missing: {path}")
    print(json.dumps({"ok": True, "ogc3DTiles": "1.1", "glbCount": len(uris), "sha256Verified": True}))

if __name__ == "__main__":
    main()
