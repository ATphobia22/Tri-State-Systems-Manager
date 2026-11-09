"""Secure bounded I3S Scene Layer Package importer for disconnected TSM scenes.

SLPK is a ZIP archive whose individual resources are often GZIP compressed.
Do not blindly extract it or infer a legal survey, building height or vertical
datum from a scene mesh. This importer preserves original bytes, verifies a
Merkle commitment, and publishes a local catalog with explicit uncertainty.

The importer does not implement a complete I3S renderer, transcode geometry or
assert that Esri-hosted imagery can be redistributed.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import re
import shutil
import stat
import sys
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend.merkle_evidence import build_manifest, verify_manifest

ROOT_LAYER = ("3dSceneLayer.json.gz", "3dSceneLayer.json")
SPEC_URL = "https://github.com/Esri/i3s-spec"
VERSION = "tsm.offline-i3s-scene.v1"


def _member_name(info: zipfile.ZipInfo) -> str:
    name = info.filename
    if (not name or "\\x00" in name or "\\\\" in name or name.startswith("/")
            or re.match(r"^[a-zA-Z]:", name)
            or any(part in ("", ".", "..") for part in name.split("/"))):
        raise ValueError("I3S_UNSAFE_ARCHIVE_PATH")
    if len(name) > 512:
        raise ValueError("I3S_PATH_TOO_LONG")
    mode = (info.external_attr >> 16) & 0xFFFF
    if stat.S_IFMT(mode) not in (0, stat.S_IFREG, stat.S_IFDIR):
        raise ValueError("I3S_ARCHIVE_LINK_OR_SPECIAL_FILE")
    return name


def _read_layer_json(raw: bytes, compressed: bool, limit: int = 8_000_000) -> dict:
    if compressed:
        with gzip.GzipFile(fileobj=__import__("io").BytesIO(raw)) as stream:
            body = stream.read(limit + 1)
    else:
        body = raw
    if len(body) > limit:
        raise ValueError("I3S_LAYER_DESCRIPTION_TOO_LARGE")
    data = json.loads(body)
    if not isinstance(data, dict) or not isinstance(data.get("store"), dict):
        raise ValueError("I3S_LAYER_DESCRIPTION_INVALID")
    if not any(key in data for key in ("layerType", "profile")):
        raise ValueError("I3S_LAYER_PROFILE_UNDEFINED")
    return data


def unpack_slpk(path: Path, directory: Path, *, max_files: int = 100_000,
                max_uncompressed: int = 8_000_000_000,
                max_single_file: int = 256_000_000) -> dict:
    """Extract only bounded regular files, using exclusive staging and atomic rename."""
    if not path.is_file() or path.is_symlink() or path.suffix.lower() != ".slpk":
        raise ValueError("I3S_SLPK_FILE_REQUIRED")
    if directory.exists():
        raise FileExistsError("I3S_OUTPUT_ALREADY_EXISTS")
    if not 0 < max_files <= 500_000 or max_uncompressed <= 0 or max_single_file <= 0:
        raise ValueError("I3S_BUDGET_INVALID")
    directory.parent.mkdir(parents=True, exist_ok=True)
    staged = Path(tempfile.mkdtemp(prefix=".tsm-i3s-", dir=directory.parent))
    try:
        with zipfile.ZipFile(path) as archive:
            members = [info for info in archive.infolist() if not info.is_dir()]
            if not members or len(members) > max_files:
                raise ValueError("I3S_ARCHIVE_FILE_COUNT_EXCEEDED")
            names = [_member_name(info) for info in members]
            if len({name.casefold() for name in names}) != len(names):
                raise ValueError("I3S_DUPLICATE_OR_CASE_COLLIDING_NAMES")
            if not any(name in ROOT_LAYER for name in names):
                raise ValueError("I3S_SCENE_LAYER_ROOT_MISSING")
            total = 0
            for info in members:
                if info.file_size > max_single_file:
                    raise ValueError("I3S_SINGLE_RESOURCE_TOO_LARGE")
                total += info.file_size
                if total > max_uncompressed:
                    raise ValueError("I3S_ARCHIVE_SIZE_BUDGET_EXCEEDED")
                if info.compress_size == 0 and info.file_size:
                    raise ValueError("I3S_ZERO_COMPRESSED_LENGTH")
                if info.compress_size and info.file_size > 200 * max(1, info.compress_size):
                    raise ValueError("I3S_ZIP_EXPANSION_RATIO_EXCEEDED")
            for info in members:
                name = _member_name(info)
                destination = staged.joinpath(*PurePosixPath(name).parts)
                destination.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(info) as source, destination.open("xb") as target:
                    copied = 0
                    while True:
                        block = source.read(1024 * 1024)
                        if not block:
                            break
                        copied += len(block)
                        if copied > info.file_size or copied > max_single_file:
                            raise ValueError("I3S_EXTRACTION_BYTE_LIMIT_EXCEEDED")
                        target.write(block)
                    if copied != info.file_size:
                        raise ValueError("I3S_EXTRACTION_SIZE_MISMATCH")
        root_name = next((name for name in ROOT_LAYER if (staged / name).is_file()), None)
        if root_name is None:
            raise ValueError("I3S_SCENE_LAYER_ROOT_MISSING")
        description = _read_layer_json((staged / root_name).read_bytes(),
                                       root_name.endswith(".gz"))
        archive_digest = hashlib.sha256(path.read_bytes()).hexdigest()
        artifacts = [("i3s_resource", name) for name in sorted(names)
                     if name != "@specialIndexFileHASH128@"]
        artifacts.append(("i3s_metadata", root_name))
        # One role/path pair per item; the scene root is already present as resource.
        artifacts = list(dict.fromkeys(artifacts))
        manifest = build_manifest(staged, artifacts)
        if not verify_manifest(staged, manifest):
            raise ValueError("I3S_EVIDENCE_MERKLE_MISMATCH")
        catalog = {
            "schemaVersion": VERSION,
            "format": "I3S-SLPK",
            "sourceFilename": path.name,
            "archiveSha256": archive_digest,
            "archiveByteLength": path.stat().st_size,
            "sourceOrigin": "USER_SUPPLIED_UNAUTHENTICATED_PACKAGE",
            "specification": SPEC_URL,
            "rootResource": root_name,
            "layerType": description.get("layerType"),
            "profile": description.get("profile"),
            "spatialReference": description.get("spatialReference"),
            "heightModelInfo": description.get("heightModelInfo"),
            "resourceCount": len(names),
            "rawResourceByteLength": total,
            "merkleRootSha256": manifest["merkleRootSha256"],
            "merkleAlgorithm": manifest["algorithm"],
            "authorityStatus": "NOT_EVIDENCED",
            "verticalDatumVerified": False,
            "buildingHeightVerified": False,
            "regulatoryApproval": False,
            "renderingVerified": False,
            "warning": "Scene content imported for offline inspection. It is not certified geodetic control and may require an I3S-capable renderer/ESLPK handler.",
        }
        (staged / "tsm-scene-catalog.json").write_text(
            json.dumps(catalog, sort_keys=True, indent=2) + "\n", encoding="utf8")
        (staged / "tsm-merkle-manifest.json").write_text(
            json.dumps(manifest, sort_keys=True, indent=2) + "\n", encoding="utf8")
        staged.rename(directory)
        return catalog
    finally:
        if staged.exists():
            shutil.rmtree(staged)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--slpk", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--max-files", type=int, default=100_000)
    args = parser.parse_args()
    print(json.dumps(unpack_slpk(args.slpk, args.output, max_files=args.max_files), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
