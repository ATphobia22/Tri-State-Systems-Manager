#!/usr/bin/env python3
"""Strict validation for the generated TSM OGC 3D Tiles terrain artifact."""
from __future__ import annotations
import argparse, hashlib, json, math, struct
from pathlib import Path

def walk(node, uris):
    if not isinstance(node, dict): raise ValueError("tile node must be an obj    volume = node.get("boundingVolume")
    if not isinstance(volume, dict):
        raise ValueError("tile boundingVolume must be an object")
    kinds = [key for key in ("box", "sphere", "region") if key in volume]
    if len(kinds) != 1:
        raise ValueError("tile must specify exactly one box, sphere, or region bounding volume")
    kind = kinds[0]
    values = volume[kind]
    required_length = {"box": 12, "sphere": 4, "region": 6}[kind]
    if (not isinstance(values, list) or len(values) != required_length
            or any(type(v) not in (int, float) or not math.isfinite(v) for v in values)):
        raise ValueError(f"{kind} bounding volume must contain {required_length} finite numbers")
    if kind == "sphere" and values[3] < 0:
        raise ValueError("sphere radius cannot be negative")
    if kind == "region":
        west, south, east, north, minimum_height, maximum_height = values
        # OGC 3D Tiles 1.1: longitudes/latitudes are radians; heights are meters.
        # west > east legitimately describes a region crossing the antimeridian.
        if (not -math.pi <= west <= math.pi
                or not -math.pi <= east <= math.pi
                or not -math.pi / 2 <= south <= north <= math.pi / 2
                or minimum_height > maximum_height):
            raise ValueError("invalid region longitude/latitude radians or height order")
    error = node.get("geometricError")
    if type(error) not in (int, float) or not math.isfinite(error) or error < 0:
        raise ValueError("geometricError must be a finite nonnegative number")
ror")
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
