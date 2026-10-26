#!/usr/bin/env python3
"""Non-destructive, evidence-linked Draco/Meshopt compression for OGC 3D Tiles GLBs.

The authoritative uncompressed input is immutable. Produces a *staged* derived
tileset only when every explicitly referenced GLB passes codec, graph, and
decoder checks. Does not generate missing 3D buildings or establish survey QA.
PMTiles is for vector/raster XYZ overlays, not this GLB content hierarchy.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import struct
import subprocess
import tempfile
from pathlib import Path, PurePosixPath

VERSION = "tsm.hlod-codec-evidence.v1"
REQUIRED_EXTENSION = {"draco": "KHR_draco_mesh_compression", "meshopt": "EXT_meshopt_compression"}


class CodecError(ValueError):
    pass


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def glb_json(path: Path) -> dict:
    """Strict minimal GLB 2.0 container parser; decoder verification is separate."""
    with path.open("rb") as file:
        raw = file.read()
    if len(raw) < 20 or raw[:4] != b"glTF":
        raise CodecError(f"Not a glTF binary: {path.name}")
    version, size = struct.unpack_from("<II", raw, 4)
    if version != 2 or size != len(raw):
        raise CodecError(f"Invalid glTF version or binary length: {path.name}")
    position = 12
    doc = None
    bin_count = 0
    while position < len(raw):
        if position + 8 > len(raw):
            raise CodecError("GLB chunk header truncated")
        length, chunk_type = struct.unpack_from("<II", raw, position)
        position += 8
        if length % 4 or position + length > len(raw):
            raise CodecError("Unaligned or truncated GLB chunk")
        chunk = raw[position:position + length]
        position += length
        if chunk_type == 0x4E4F534A:
            if doc is not None:
                raise CodecError("Duplicate GLB JSON chunk")
            doc = json.loads(chunk.decode("utf-8").rstrip(" \x00"))
        elif chunk_type == 0x004E4942:
            bin_count += 1
    if not isinstance(doc, dict) or doc.get("asset", {}).get("version") != "2.0" or bin_count != 1:
        raise CodecError("GLB requires one JSON chunk and one BIN chunk")
    return doc


def geometry_signature(doc: dict) -> list:
    """Check triangle primitive topology counts without treating quantization as survey."""
    accesses = doc.get("accessors", [])
    out = []
    for mesh in doc.get("meshes", []):
        for prim in mesh.get("primitives", []):
            if prim.get("mode", 4) != 4:
                raise CodecError("Only TRIANGLES glTF geometry is accepted")
            pos_index = prim.get("attributes", {}).get("POSITION")
            if not isinstance(pos_index, int) or pos_index < 0 or pos_index >= len(accesses):
                raise CodecError("Missing POSITION accessor")
            index = prim.get("indices")
            if not isinstance(index, int) or index < 0 or index >= len(accesses):
                raise CodecError("Indexed triangle meshes are required")
            p_count, i_count = accesses[pos_index].get("count"), accesses[index].get("count")
            if not isinstance(p_count, int) or not isinstance(i_count, int) or p_count < 3 or i_count < 3 or i_count % 3:
                raise CodecError("Invalid POSITION or triangle index counts")
            out.append((p_count, i_count))
    if not out:
        raise CodecError("GLB has no supported indexed triangle primitives")
    return out


def _relpath(root: Path, uri: str) -> tuple[Path, str]:
    if not isinstance(uri, str) or not uri.endswith(".glb") or "\\" in uri or "?" in uri or "#" in uri:
        raise CodecError("Only relative local .glb tileset content URIs are supported")
    path = PurePosixPath(uri)
    if path.is_absolute() or ".." in path.parts or not path.parts or any(p in ("", ".") for p in path.parts):
        raise CodecError("Unsafe GLB content URI")
    target = root.joinpath(*path.parts)
    if not target.is_file() or target.is_symlink() or not target.resolve().is_relative_to(root.resolve()):
        raise CodecError(f"Missing or unsafe GLB source: {uri}")
    return target, path.as_posix()


def tileset_sources(root: Path, tileset: dict) -> dict[str, list]:
    if not isinstance(tileset, dict) or not isinstance(tileset.get("root"), dict):
        raise CodecError("Expected explicit 3D Tiles root")
    source_ids: dict[str, list] = {}

    def walk(node: dict) -> None:
        if "implicitTiling" in node:
            raise CodecError("Implicit tilesets require a separate content-addressed rewrite adapter")
        refs = ([node["content"]] if "content" in node else []) + node.get("contents", [])
        for entry in refs:
            src, name = _relpath(root, entry.get("uri") if isinstance(entry, dict) else "")
            tsm = node.get("extras", {}).get("tsm", {})
            feature_id = tsm.get("sourceObjectId") if isinstance(tsm, dict) else None
            source_ids.setdefault(name, [])
            if isinstance(feature_id, int) and not isinstance(feature_id, bool):
                source_ids[name].append(feature_id)
        for child in node.get("children", []):
            if not isinstance(child, dict):
                raise CodecError("Malformed tileset child")
            walk(child)

    walk(tileset["root"])
    if not source_ids:
        raise CodecError("No explicit GLB tileset contents")
    return dict(sorted(source_ids.items()))


def stage_compression(source: Path, output: Path, codec: str, executable: Path,
                      dry_run: bool = False) -> dict:
    if codec not in REQUIRED_EXTENSION:
        raise CodecError("Codec must be meshopt or draco")
    source, output = source.resolve(), output.resolve()
    if source == output or source.is_relative_to(output) or output.is_relative_to(source):
        raise CodecError("Source/output must be disjoint directories")
    if not (source / "tileset.json").is_file():
        raise CodecError("Missing authoritative source tileset.json")
    if output.exists():
        raise CodecError("Refusing to overwrite an existing output directory")
    if not dry_run and not executable.is_file():
        raise CodecError("Local pinned glTF Transform CLI is not installed")
    tileset_file = source / "tileset.json"
    tileset = json.loads(tileset_file.read_text(encoding="utf-8"))
    contents = tileset_sources(source, tileset)
    originals = {name: {"sha256": sha256(source / name), "bytes": (source / name).stat().st_size,
                        "sourceObjectIds": sorted(set(contents[name]))} for name in contents}
    if dry_run:
        return {"schemaVersion": VERSION, "codec": codec, "state": "PREFLIGHT_ONLY",
                "inputGlbCount": len(contents), "sourceTilesetSha256": sha256(tileset_file),
                "originals": originals}

    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=".tsm-hlod-codec-", dir=output.parent))
    try:
        compressed = {}
        for name in contents:
            src = source / name
            dst = temporary / name
            dst.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run([str(executable), codec, str(src), str(dst)], check=True,
                           stdout=subprocess.DEVNULL)
            before, after = glb_json(src), glb_json(dst)
            if geometry_signature(before) != geometry_signature(after):
                raise CodecError(f"Codec altered primitive vertex/index counts: {name}")
            if REQUIRED_EXTENSION[codec] not in after.get("extensionsUsed", []):
                raise CodecError(f"Expected {REQUIRED_EXTENSION[codec]} extension not found: {name}")
            # Decoder smoke test loads the newly compressed asset. Native Unreal
            # Cesium renderer acceptance is a separate mandatory hardware gate.
            subprocess.run([str(executable), "inspect", str(dst)], check=True,
                           stdout=subprocess.DEVNULL)
            compressed[name] = {"sha256": sha256(dst), "bytes": dst.stat().st_size,
                                "sourceSha256": originals[name]["sha256"],
                                "sourceObjectIds": originals[name]["sourceObjectIds"]}
        derived_tileset = json.loads(json.dumps(tileset))
        extras = derived_tileset.setdefault("extras", {}).setdefault("tsm", {})
        extras["compression"] = {
            "codec": codec, "extension": REQUIRED_EXTENSION[codec],
            "classification": "INFORMATIONAL_ONLY",
            "sourceTilesetSha256": sha256(tileset_file),
            "surveyGradeCertified": False, "nativeCesiumAcceptance": "PENDING",
        }
        (temporary / "tileset.json").write_text(
            json.dumps(derived_tileset, sort_keys=True, separators=(",", ":")) + "\n",
            encoding="utf-8")
        result = {
            "schemaVersion": VERSION, "codec": codec, "state": "DERIVED_CODEC_UNVERIFIED_NATIVE",
            "inputGlbCount": len(contents), "outputGlbCount": len(compressed),
            "sourceTilesetSha256": sha256(tileset_file),
            "sourceManifestSha256": sha256(source / "manifest.json")
            if (source / "manifest.json").is_file() else None,
            "outputTilesetSha256": sha256(temporary / "tileset.json"),
            "inputBytes": sum(x["bytes"] for x in originals.values()),
            "compressedBytes": sum(x["bytes"] for x in compressed.values()),
            "contents": compressed,
            "engineeringUse": "NOT_AUTHORIZED", "regulatoryDetermination": None,
        }
        (temporary / "codec-evidence.json").write_text(
            json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        hashes = [f"{sha256(temporary / name)}  {name}" for name in contents]
        for name in ("tileset.json", "codec-evidence.json"):
            hashes.append(f"{sha256(temporary / name)}  {name}")
        (temporary / "SHA256SUMS").write_text("\n".join(hashes) + "\n", encoding="utf-8")
        # Collision check immediately before atomic publication.
        if output.exists():
            raise CodecError("Output directory appeared during staging")
        temporary.rename(output)
        return result
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--codec", choices=sorted(REQUIRED_EXTENSION), default="meshopt")
    ap.add_argument("--gltf-transform", type=Path,
                    default=Path("tsm-console/node_modules/.bin/gltf-transform"))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    print(json.dumps(stage_compression(args.source, args.output, args.codec,
                                       args.gltf_transform, args.dry_run), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
