#!/usr/bin/env python3
"""Stage already-georeferenced OGC 3D Tiles 1.1 for a disconnected runtime.

This is a strict *stager*, not a GLB-to-geodesy converter. Use TSM's existing
build-building-3d-tiles.py and validate-building-3d-tiles.py first. A GLB alone
does not provide trustworthy ECEF position or bounding volumes.
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
import sys
import tempfile

MAX_MANIFEST = 16 * 1024 * 1024
MAX_ASSET = 2 * 1024 * 1024 * 1024
MAX_TILES = 100_000
SHA = re.compile(r"^[0-9a-f]{64}$")


def check(condition, reason):
    if not condition:
        raise ValueError(reason)


def safe_uri(uri):
    check(isinstance(uri, str) and uri and len(uri) < 512 and "\\" not in uri
          and not uri.startswith("/") and ":" not in uri and "%" not in uri
          and "?" not in uri and "#" not in uri, "Unsafe tile content URI")
    parts = PurePosixPath(uri).parts
    check(parts and all(x not in ("..", ".") and x and not x.endswith((".", " ")) for x in parts),
          "Tile URI traversal or Windows-unsafe path")
    check(parts[-1].lower().endswith(".glb"), "Renderable tile content must be GLB")
    return uri


def finite(values, length):
    return (isinstance(values, list) and len(values) == length
            and all(isinstance(x, (int, float)) and not isinstance(x, bool)
                    and math.isfinite(x) for x in values))


def validate_box(box):
    check(finite(box, 12), "Tile boundingVolume.box requires 12 finite numbers")
    a = box[3:6]
    b = box[6:9]
    c = box[9:12]
    norms = [sum(x * x for x in v) for v in (a, b, c)]
    check(all(v > 0 for v in norms), "Tile box has a zero-length axis")
    dot = lambda x, y: sum(i * j for i, j in zip(x, y))
    check(abs(dot(a, b)) < 1e-5 * math.sqrt(norms[0] * norms[1])
          and abs(dot(a, c)) < 1e-5 * math.sqrt(norms[0] * norms[2])
          and abs(dot(b, c)) < 1e-5 * math.sqrt(norms[1] * norms[2]),
          "Tile bounding box axes must be orthogonal")


def walk_tileset(data):
    check(isinstance(data, dict) and data.get("asset", {}).get("version") == "1.1",
          "3D Tiles asset.version must equal 1.1")
    check(isinstance(data.get("root"), dict), "Missing root tile")
    check(isinstance(data.get("geometricError"), (int, float))
          and not isinstance(data["geometricError"], bool)
          and math.isfinite(data["geometricError"]) and data["geometricError"] >= 0,
          "Invalid tileset geometricError")
    uris = []
    count = 0

    def walk(tile):
        nonlocal count
        count += 1
        check(count <= MAX_TILES, "Tile count limit exceeded")
        check(isinstance(tile, dict), "Tile must be object")
        bv = tile.get("boundingVolume")
        check(isinstance(bv, dict) and len(set(bv) & {"box", "sphere", "region"}) == 1,
              "Missing or ambiguous tile boundingVolume")
        if "box" in bv:
            validate_box(bv["box"])
        elif "sphere" in bv:
            check(finite(bv["sphere"], 4) and bv["sphere"][3] >= 0, "Invalid sphere")
        else:
            r = bv["region"]
            check(finite(r, 6) and r[0] <= r[2] and r[1] <= r[3]
                  and all(-math.pi <= x <= math.pi for x in (r[0], r[2]))
                  and all(-math.pi / 2 <= x <= math.pi / 2 for x in (r[1], r[3]))
                  and r[4] <= r[5], "Invalid geographic region")
        if "transform" in tile:
            check(finite(tile["transform"], 16), "Invalid tile transform")
        error = tile.get("geometricError")
        check(isinstance(error, (int, float)) and not isinstance(error, bool)
              and math.isfinite(error) and error >= 0, "Invalid tile geometricError")
        check(tile.get("refine", "ADD") in ("ADD", "REPLACE"), "Invalid refine")
        content = tile.get("content")
        if content is not None:
            check(isinstance(content, dict), "Invalid content")
            uris.append(safe_uri(content.get("uri")))
        check("contents" not in tile, "Multiple contents require a separate validated staging path")
        children = tile.get("children", [])
        check(isinstance(children, list), "Invalid children")
        for child in children:
            walk(child)
    walk(data["root"])
    check(uris, "No renderable GLB content in tileset")
    check(len(uris) == len(set(uris)), "Duplicate content URIs")
    return sorted(uris)


def validate_glb(path):
    import struct
    with path.open("rb") as f:
        header = f.read(20)
        check(len(header) == 20 and header[:4] == b"glTF", "Invalid GLB magic")
        version, length, chunk_length = struct.unpack_from("<III", header, 4)
        check(version == 2 and length == path.stat().st_size and 20 + chunk_length <= length,
              "GLB version or declared length invalid")
        check(header[16:20] == b"JSON", "First GLB chunk must be JSON")
        raw = f.read(chunk_length)
        check(len(raw) == chunk_length, "Truncated GLB JSON chunk")
        doc = json.loads(raw.decode("utf-8").rstrip(" \x00"))
        check(doc.get("asset", {}).get("version") == "2.0", "GLB must contain glTF 2.0")
        check(isinstance(doc.get("meshes"), list) and doc["meshes"], "GLB has no meshes")
        check(not any("uri" in b for b in doc.get("buffers", [])),
              "External GLB buffers are not supported for air-gapped staging")
        check(not any("uri" in i for i in doc.get("images", [])),
              "External image URIs are not supported for air-gapped staging")
        return doc


def stage(input_tileset, output):
    check(input_tileset.is_file() and not input_tileset.is_symlink(),
          "Input tileset must be a real file")
    check(input_tileset.stat().st_size <= MAX_MANIFEST, "Tileset JSON too large")
    check(not output.exists(), "Output directory must not exist")
    root = input_tileset.parent.resolve()
    data = json.loads(input_tileset.read_text(encoding="utf-8"))
    uris = walk_tileset(data)
    # Staging does not create or correct georeferencing. Caller must verify ECEF
    # placement and bounding-volume containment using the existing TSM validators.
    check("transform" in data["root"] or "region" in data["root"]["boundingVolume"],
          "Explicit root georeferencing required; identity/unknown local coordinates rejected")
    manifest = []
    with tempfile.TemporaryDirectory(prefix=".tsm-tiles-stage-", dir=output.parent) as tmp:
        staging = Path(tmp)
        for uri in uris:
            source = root
            for part in PurePosixPath(uri).parts:
                source = source / part
                check(not source.is_symlink(), "Symlink in tile path")
            check(source.resolve().is_relative_to(root), "Tile escapes input directory")
            check(source.is_file() and 0 < source.stat().st_size <= MAX_ASSET,
                  "Missing or oversized tile asset")
            validate_glb(source)
            dest = staging / uri
            dest.parent.mkdir(parents=True, exist_ok=True)
            digest = hashlib.sha256()
            with source.open("rb") as src, dest.open("xb") as dst:
                while block := src.read(1024 * 1024):
                    digest.update(block)
                    dst.write(block)
            manifest.append({"path": uri, "sha256": digest.hexdigest(),
                             "sizeBytes": dest.stat().st_size})
        manifest_json = json.dumps(data, indent=2, allow_nan=False) + "\n"
        (staging / "tileset.json").write_text(manifest_json, encoding="utf-8")
        manifest.insert(0, {
            "path": "tileset.json",
            "sha256": hashlib.sha256(manifest_json.encode()).hexdigest(),
            "sizeBytes": len(manifest_json.encode()),
        })
        (staging / "offline-asset-manifest.json").write_text(json.dumps({
            "schema": "tsm.offline-3d-tiles-stage.v1",
            "assetCount": len(uris),
            "files": manifest,
            "engineeringUse": False,
            "regulatoryUse": False,
            "geospatialPlacementIndependentlyVerified": False,
            "windowsShippingRuntimeVerified": False,
            "note": "Integrity staging only. Validate ECEF/geodesy and UE5.8 offline startup separately.",
        }, indent=2) + "\n", encoding="utf-8")
        staging.rename(output)
    return len(uris)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tileset", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        print(json.dumps({"stagedGlbs": stage(args.tileset, args.output),
                          "status": "INTEGRITY_STAGED_NOT_SHIPPING_VERIFIED"}))
        return 0
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print("Offline 3D Tiles staging rejected: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
