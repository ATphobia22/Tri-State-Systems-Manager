#!/usr/bin/env python3
"""Independently repeatable byte/identity audit of an extracted Posey 3D Tiles set.

The caller must have *safely extracted* the downloaded .tar.zst in a disposable
directory after confirming no absolute/.. members or symlinks. This command
reads files only, never fetches/deploys them. Hashes establish internal archive
consistency; they do NOT certify source acquisition, datum or survey control.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import re
import struct

MAX_CONTENT = 250000
MAX_TILESET_BYTES = 96 * 1024 * 1024
MAX_GLB_BYTES = 32 * 1024 * 1024
SHA_LINE = re.compile(r"([0-9a-f]{64})  ([A-Za-z0-9_.-]+)\Z")


class ArchiveAuditError(ValueError):
    """Inconsistent or insufficient archive evidence."""


def regular(path: Path, max_bytes: int) -> Path:
    if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= max_bytes:
        raise ArchiveAuditError(f"INVALID_OR_UNBOUNDED_FILE:{path.name}")
    return path


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as src:
        for chunk in iter(lambda: src.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load(path: Path, max_bytes: int = MAX_TILESET_BYTES) -> dict:
    try:
        value = json.loads(regular(path, max_bytes).read_text(encoding="utf-8"))
    except (ValueError, UnicodeError) as exc:
        raise ArchiveAuditError(f"INVALID_JSON:{path.name}") from exc
    if not isinstance(value, dict):
        raise ArchiveAuditError(f"JSON_NOT_OBJECT:{path.name}")
    return value


def audit(root: Path, *, archive: Path | None = None, expected_archive_sha256: str | None = None) -> dict:
    if root.is_symlink() or not root.is_dir():
        raise ArchiveAuditError("EXTRACTED_DIRECTORY_REQUIRED")
    base = root / "flat"
    local = root / "flat-local"
    implicit = root / "implicit-local"
    if not base.is_dir() or base.is_symlink() or not local.is_dir() or local.is_symlink():
        raise ArchiveAuditError("MISSING_FLAT_AND_LOCAL_TILESETS")
    if archive is not None:
        regular(archive, MAX_TILESET_BYTES * 16)
        if expected_archive_sha256 is None or not re.fullmatch(r"[0-9a-f]{64}", expected_archive_sha256):
            raise ArchiveAuditError("EXPECTED_ARCHIVE_DIGEST_REQUIRED")
        if sha256(archive) != expected_archive_sha256:
            raise ArchiveAuditError("ARCHIVE_SHA256_MISMATCH")
    manifest = load(base / "manifest.json")
    tileset = load(base / "tileset.json")
    if manifest.get("artifactId") != "tsm-buildings-3d-tiles-lod1":
        raise ArchiveAuditError("UNRECOGNIZED_PRODUCT")
    inputs = manifest.get("input")
    if not isinstance(inputs, dict) or not isinstance(manifest.get("source"), dict):
        raise ArchiveAuditError("MISSING_INPUT_EVIDENCE")
    if manifest.get("engineeringUse") is not False or manifest.get("regulatoryUse") is not False:
        raise ArchiveAuditError("INVALID_AUTHORITY_CLAIM")
    content = manifest.get("content")
    children = tileset.get("root", {}).get("children")
    declared_sources = inputs.get("heightSources")
    if not isinstance(content, list) or not isinstance(children, list) or not isinstance(declared_sources, dict):
        raise ArchiveAuditError("MISSING_CONTENT_OR_SOURCE")
    if not 0 < len(content) <= MAX_CONTENT or len(children) != len(content):
        raise ArchiveAuditError("INCONSISTENT_CHILD_COUNT")
    if len(set(content)) != len(content) or not all(re.fullmatch(r"[0-9]+\.glb", x) for x in content):
        raise ArchiveAuditError("INVALID_OR_DUPLICATE_CONTENT_NAME")
    flat_glbs = {f.name for f in base.glob("*.glb")}
    local_glbs = {f.name for f in local.glob("*.glb")}
    if flat_glbs != set(content) or local_glbs != flat_glbs:
        raise ArchiveAuditError("FLAT_LOCAL_CONTENT_DIFFERENCE")
    if len(content) != manifest.get("tileCount") or len(content) != inputs.get("featureCount") or len(content) != manifest["source"].get("sourceFeatureCount"):
        raise ArchiveAuditError("SOURCE_COUNTS_DO_NOT_MATCH")
    hashes: dict[str, str] = {}
    for line in regular(base / "SHA256SUMS", 24 * 1024 * 1024).read_text().splitlines():
        m = SHA_LINE.fullmatch(line)
        if not m or m.group(2) in hashes:
            raise ArchiveAuditError("MALFORMED_OR_DUPLICATE_CHECKSUM")
        hashes[m.group(2)] = m.group(1)
    if set(hashes) != flat_glbs | {"manifest.json", "tileset.json"}:
        raise ArchiveAuditError("CHECKSUM_INVENTORY_MISMATCH")
    for name, expected in hashes.items():
        target = regular(base / name, MAX_TILESET_BYTES if name.endswith(".json") else MAX_GLB_BYTES)
        if sha256(target) != expected:
            raise ArchiveAuditError(f"BAD_SHA256:{name}")
        if name.endswith(".glb"):
            with target.open("rb") as fp:
                header = fp.read(20)
            if len(header) != 20:
                raise ArchiveAuditError(f"INVALID_GLB:{name}")
            magic, version, length, chunk_length, chunk_type = struct.unpack("<4sIIII", header)
            if magic != b"glTF" or version != 2 or length != target.stat().st_size or chunk_type != 0x4E4F534A or chunk_length < 2:
                raise ArchiveAuditError(f"INVALID_GLB:{name}")
    ids: set[int] = set()
    heights: list[float] = []
    grounds: list[float] = []
    kinds: Counter[str] = Counter()
    for child in children:
        if not isinstance(child, dict):
            raise ArchiveAuditError("INVALID_TILE_CHILD")
        metadata = child.get("extras", {}).get("tsm", {})
        object_id = metadata.get("sourceObjectId")
        if type(object_id) is not int or object_id < 1 or object_id in ids:
            raise ArchiveAuditError("INVALID_OR_DUPLICATE_OBJECTID")
        ids.add(object_id)
        if child.get("content", {}).get("uri") != f"{object_id}.glb":
            raise ArchiveAuditError("OBJECTID_AND_GLB_URI_MISMATCH")
        for label, series in (("lidarHeightFt", heights), ("groundElevationFtNavd88", grounds)):
            value = metadata.get(label)
            if type(value) not in (int, float) or not math.isfinite(value):
                raise ArchiveAuditError("MISSING_NONFINITE_" + label)
            series.append(float(value))
        kind = metadata.get("heightProvenance")
        if kind not in ("OBSERVED", "DERIVED"):
            raise ArchiveAuditError("INVALID_HEIGHT_PROVENANCE")
        kinds[kind] += 1
    if dict(kinds) != {str(k): v for k, v in declared_sources.items() if v != 0}:
        raise ArchiveAuditError("HEIGHT_SOURCE_COUNTS_MISMATCH")
    if len(ids) != len(content):
        raise ArchiveAuditError("IDENTITY_CONFLICT")
    return {
        "auditFormat": "tsm.posey-lod1-internal-audit.v1",
        "internalConsistencyVerified": True,
        "archiveSha256": expected_archive_sha256 if archive is not None else None,
        "sourceGeojsonSha256Declared": inputs.get("geojsonSha256"),
        "sourceFeatureCount": manifest["source"]["sourceFeatureCount"],
        "flatGLBCount": len(flat_glbs),
        "flatLocalGLBCount": len(local_glbs),
        "checkedSha256Entries": len(hashes),
        "tileSourceObjectIdCount": len(ids),
        "sourceObjectIdRange": [min(ids), max(ids)],
        "heightSourceCounts": dict(kinds),
        "lidarHeightFtRange": [min(heights), max(heights)],
        "groundElevationFtNavd88DeclaredRange": [min(grounds), max(grounds)],
        "implicitContentGLBCount": len(list(implicit.glob("content/**/*.glb"))) if implicit.is_dir() else None,
        "differentCountyInventoryReconciled": False,
        "verticalDatumIndependentlyValidated": False,
        "surveyCertified": False,
        "regulatoryApproved": False,
        "headed3DTilesRendererVerified": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extracted-root", type=Path, required=True)
    parser.add_argument("--archive", type=Path)
    parser.add_argument("--expected-archive-sha256")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        report = audit(args.extracted_root, archive=args.archive,
                       expected_archive_sha256=args.expected_archive_sha256)
        if args.output.exists() or args.output.is_symlink() or not args.output.parent.is_dir():
            raise ArchiveAuditError("OUTPUT_MUST_BE_NEW_FILE")
        with args.output.open("x", encoding="utf-8") as fp:
            json.dump(report, fp, indent=2, sort_keys=True, allow_nan=False)
            fp.write("\n")
    except (OSError, ArchiveAuditError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps({"state": "INTERNALLY_CONSISTENT_NOT_SURVEY_CERTIFIED",
                      "count": report["flatGLBCount"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
