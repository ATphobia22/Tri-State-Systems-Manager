#!/usr/bin/env python3
"""Strict offline OGC 3D Tiles 1.1 glTF/GLB staging.

Stages EXISTING local content only. Refuses fake tiles, external URLs, symlinks,
unbounded files, unresolved world placement and invalid GLB headers. These are
byte/structural checks, NOT survey accuracy or Unreal Shipping certification.

Usage:
 python scripts/geospatial/tsm_tileset_packager.py \
   --tileset path/to/tileset.json --out path/to/new-offline-stage/
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import struct
import sys
import tempfile

MAX_JSON_BYTES = 8 * 1024 * 1024
MAX_ASSET_BYTES = 2 * 1024 * 1024 * 1024
MAX_CONTENTS = 50_000
MAX_DEPTH = 64
SAFE_EXTENSION = {".glb"}


def require(test, reason):
    if not test:
        raise ValueError(reason)


def numbers(values, count, name):
    require(isinstance(values, list) and len(values) == count
            and all(isinstance(v, (float, int)) and not isinstance(v, bool)
                    and math.isfinite(v) for v in values), "Invalid " + name)
    return [float(v) for v in values]


def _length(v):
    return math.sqrt(sum(x*x for x in v))


def _bounding_volume(value):
    require(isinstance(value, dict), "Invalid 3D Tiles boundingVolume")
    kinds = [k for k in ("box", "region", "sphere") if k in value]
    require(len(kinds) == 1, "Exactly one supported 3D Tiles bounding volume is required")
    kind = kinds[0]
    if kind == "box":
        v = numbers(value[kind], 12, "boundingVolume.box")
        for start in (3, 6, 9):
            require(_length(v[start:start+3]) > 0, "Invalid zero-volume 3D Tiles box")
        # Three half-axis vectors must span a true 3D volume.
        a, b, c = v[3:6], v[6:9], v[9:12]
        determinant = (a[0]*(b[1]*c[2]-b[2]*c[1])
                       -a[1]*(b[0]*c[2]-b[2]*c[0])
                       +a[2]*(b[0]*c[1]-b[1]*c[0]))
        require(abs(determinant) > 1e-12, "Degenerate 3D Tiles bounding box")
    elif kind == "region":
        v = numbers(value[kind], 6, "boundingVolume.region")
        require(-math.pi <= v[0] < v[2] <= math.pi,
                "Invalid WGS84 longitude bounds")
        require(-math.pi/2 <= v[1] < v[3] <= math.pi/2,
                "Invalid WGS84 latitude bounds")
        require(v[4] <= v[5], "Invalid height bounds")
    else:
        v = numbers(value[kind], 4, "boundingVolume.sphere")
        require(v[3] > 0, "Invalid 3D Tiles bounding sphere radius")
    return kind, v


def _transform(raw):
    v = numbers(raw, 16, "tile transform")
    require(all(abs(v[i]) < 1e-9 for i in (3, 7, 11))
            and abs(v[15]-1.0) < 1e-9, "Invalid homogeneous tile transform")
    # Nondegenerate affine matrix; transform is column-major as specified.
    a = [v[0],v[1],v[2]]
    b = [v[4],v[5],v[6]]
    c = [v[8],v[9],v[10]]
    det = (a[0]*(b[1]*c[2]-b[2]*c[1])
           -a[1]*(b[0]*c[2]-b[2]*c[0])
           +a[2]*(b[0]*c[1]-b[1]*c[0]))
    require(abs(det) > 1e-12, "Degenerate tile transform")
    return v


def _uri(raw):
    require(isinstance(raw, str) and 0 < len(raw) <= 512, "Invalid content URI")
    require(not re.search(r"[%\\\x00-\x1f?#:]", raw), "Unsafe external or encoded content URI")
    p = PurePosixPath(raw)
    require(not p.is_absolute() and all(x not in (".", "..", "") for x in p.parts),
            "Unsafe local 3D Tiles URI")
    require(p.suffix.lower() in SAFE_EXTENSION, "Only self-contained GLB content is supported")
    require(all(not re.fullmatch(r"(?i)(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?", part)
                and not part.endswith((".", " ")) for part in p.parts),
            "Windows-unsafe 3D Tiles URI")
    return str(p)


def _root_georeferenced(root):
    kind, coords = _bounding_volume(root["boundingVolume"])
    if kind == "region":
        return True
    # ECEF-centered world bounds without a transform, or a nontrivial ECEF
    # transform, are acceptable *candidates*. Scientific datum and control
    # verification are separate and explicitly false in the output manifest.
    center = coords[:3]
    if 5.5e6 <= _length(center) <= 7.5e6:
        return True
    transform = root.get("transform")
    if transform is None:
        return False
    t = _transform(transform)
    return 5.5e6 <= _length(t[12:15]) <= 7.5e6


def walk_tileset(tileset):
    """Return local GLB URIs in deterministic order; reject invalid placeholders."""
    require(isinstance(tileset, dict) and isinstance(tileset.get("asset"), dict)
            and tileset["asset"].get("version") == "1.1",
            "Expected OGC 3D Tiles 1.1 JSON")
    ge = tileset.get("geometricError")
    require(type(ge) in (int, float) and math.isfinite(ge) and ge >= 0,
            "Invalid root geometricError")
    root = tileset.get("root")
    require(isinstance(root, dict), "Missing root tile")
    require(_root_georeferenced(root), "Missing/invalid ECEF or region georeferencing")
    paths = []
    nodes = [(root, 0)]
    total = 0
    while nodes:
        node, depth = nodes.pop()
        require(depth <= MAX_DEPTH, "3D Tiles tree depth exceeded")
        total += 1
        require(total <= MAX_CONTENTS, "3D Tiles node bound exceeded")
        require(isinstance(node, dict), "Invalid 3D Tiles node")
        _bounding_volume(node.get("boundingVolume"))
        ge = node.get("geometricError")
        require(type(ge) in (int, float) and math.isfinite(ge) and ge >= 0,
                "Invalid tile geometricError")
        if "transform" in node:
            _transform(node["transform"])
        require("implicitTiling" not in node,
                "Implicit subtree layouts need a separately reviewed offline stager")
        content = []
        if "content" in node:
            require(isinstance(node["content"], dict), "Invalid tile content")
            content.append(node["content"])
        if "contents" in node:
            require(isinstance(node["contents"], list), "Invalid tile contents")
            content.extend(node["contents"])
        for entry in content:
            require(isinstance(entry, dict), "Invalid tile content entry")
            paths.append(_uri(entry.get("uri")))
            require(len(paths) <= MAX_CONTENTS, "Too many 3D Tiles assets")
        children = node.get("children", [])
        require(isinstance(children, list), "Tile children must be an array")
        for child in reversed(children):
            nodes.append((child, depth+1))
    require(paths, "A renderable tileset requires real local GLB content")
    return sorted(set(paths))


def _json_file(path):
    require(not path.is_symlink() and path.is_file(), "Tileset must be a real JSON file")
    require(0 < path.stat().st_size <= MAX_JSON_BYTES, "Tileset JSON size is out of bounds")
    with path.open("rb") as stream:
        body = stream.read(MAX_JSON_BYTES+1)
    require(len(body) <= MAX_JSON_BYTES, "Tileset grew beyond safety limit")
    return json.loads(body)


def _regular_file(path, root):
    require(path.resolve().is_relative_to(root.resolve()), "Tile escapes source directory")
    current = root
    for part in path.relative_to(root).parts:
        current = current / part
        require(not current.is_symlink(), "Source tileset contains a symlink")
    require(path.is_file(), "Missing referenced tile: " + str(path))
    return path


def _check_glb(path):
    descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        info = os.fstat(descriptor)
        require(stat.S_ISREG(info.st_mode) and 20 <= info.st_size <= MAX_ASSET_BYTES,
                "Invalid GLB size")
        prefix = os.read(descriptor, 20)
        if len(prefix) != 20:
            raise ValueError("Invalid GLB header")
        magic, version, declared, chunk_len, chunk_type = struct.unpack("<4sIII4s", prefix)
        require(magic == b"glTF" and version == 2 and declared == info.st_size
                and chunk_type == b"JSON" and chunk_len > 0 and chunk_len <= MAX_JSON_BYTES
                and chunk_len + 20 <= info.st_size and chunk_len % 4 == 0,
                "Invalid GLB header or JSON chunk")
        raw = b""
        while len(raw) < chunk_len:
            part = os.read(descriptor, chunk_len-len(raw))
            require(bool(part), "Invalid GLB JSON chunk")
            raw += part
        try:
            document = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("Invalid GLB JSON") from exc
        require(isinstance(document, dict) and isinstance(document.get("asset"), dict)
                and document["asset"].get("version") == "2.0",
                "Invalid GLB glTF asset version")
        for group in ("buffers", "images", "shaders"):
            for entry in document.get(group, []):
                require(isinstance(entry, dict) and "uri" not in entry,
                        "GLB contains external resource references; no offline bundle claim permitted")
    finally:
        os.close(descriptor)


def _copy_verified(src, dest):
    digest = hashlib.sha256()
    byte_count = 0
    descriptor = os.open(src, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        before = os.fstat(descriptor)
        require(stat.S_ISREG(before.st_mode) and 0 < before.st_size <= MAX_ASSET_BYTES,
                "Invalid staged input file")
        with os.fdopen(descriptor, "rb", closefd=False) as reader, dest.open("xb") as writer:
            while chunk := reader.read(1024*1024):
                byte_count += len(chunk)
                require(byte_count <= MAX_ASSET_BYTES, "Asset size bound exceeded")
                writer.write(chunk)
                digest.update(chunk)
        after = os.fstat(descriptor)
        require(byte_count == before.st_size == after.st_size
                and before.st_mtime_ns == after.st_mtime_ns, "Asset changed during staging")
    finally:
        os.close(descriptor)
    return {"path": dest.as_posix(), "sha256": digest.hexdigest(), "sizeBytes": byte_count}


def stage(tileset_path: Path, destination: Path) -> int:
    tileset_path = Path(tileset_path)
    destination = Path(destination)
    require(not destination.exists() and not destination.is_symlink(),
            "Destination must not exist")
    require(destination.parent.is_dir() and not destination.parent.is_symlink(),
            "Destination parent must already be a real directory")
    root = tileset_path.parent
    require(root.is_dir() and not root.is_symlink(), "Source directory must not be a symlink")
    _regular_file(tileset_path, root)
    tileset = _json_file(tileset_path)
    assets = walk_tileset(tileset)
    temporary = Path(tempfile.mkdtemp(prefix=".tsm-staging-", dir=destination.parent))
    try:
        entries = []
        # Tileset first, followed by deterministic asset paths, for audit.
        source_files = [("tileset.json", tileset_path)] + [
            (uri, _regular_file(root.joinpath(*PurePosixPath(uri).parts), root)) for uri in assets
        ]
        for name, original in source_files:
            if name.endswith(".glb"):
                _check_glb(original)
            target = temporary / name
            target.parent.mkdir(parents=True, exist_ok=True)
            copied = _copy_verified(original, target)
            entries.append({
                "path": name,
                "sha256": copied["sha256"],
                "sizeBytes": copied["sizeBytes"],
            })
        manifest = {
            "schema": "tsm.offline-3dtiles-staging.v1",
            "authorityClass": "DERIVED_STAGING",
            "assetCount": len(assets),
            "files": entries,
            "geospatialPlacementIndependentlyVerified": False,
            "verticalDatumVerified": False,
            "sourceGeometrySurveyed": False,
            "materialsIndependentlyValidated": False,
            "windowsShippingRuntimeVerified": False,
            "regulatoryApproval": False,
            "note": "Existing GLB bytes structurally staged. No new geometry, datum conversion, rendering or certification.",
        }
        (temporary / "offline-asset-manifest.json").write_text(
            json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        require(not destination.exists(), "Destination must not exist")
        temporary.rename(destination)
        return len(assets)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tileset", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        count = stage(args.tileset, args.out)
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print("OFFLINE_TILESET_STAGING_REJECTED: " + str(exc), file=sys.stderr)
        return 2
    print(json.dumps({"status": "STAGED_BYTES_ONLY", "assetCount": count,
                      "shippingVerified": False}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
