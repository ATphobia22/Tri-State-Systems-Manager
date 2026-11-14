#!/usr/bin/env python3
"""Bounded, extraction-free verification of a Drive-hosted Posey GLB archive.

Reads every primary `flat/<IGIO ObjectId>.glb` binary header; never follows
or extracts archived symlinks. Verified archive bytes and GLB containers are
not evidence of calibrated heights, feature identity across different
inventories, or certified NAVD88/ECEF alignment.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import struct
import subprocess
import tarfile

SHA256 = re.compile(r"[0-9a-f]{64}\Z")
PRIMARY = re.compile(r"flat/([0-9]+)\.glb\Z")
MAX_ENTRIES = 100000
MAX_MANIFEST = 3 * 1024 * 1024


class ArchiveAuditError(ValueError):
    """The archive fails a bounded, reproducible integrity contract."""


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fp:
        for block in iter(lambda: fp.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def inspect_tar(stream) -> dict:
    count, symlinks, good, bad = 0, 0, 0, 0
    ids: set[str] = set()
    manifest = None
    with tarfile.open(fileobj=stream, mode="r|") as archive:
        for info in archive:
            count += 1
            if count > MAX_ENTRIES:
                raise ArchiveAuditError("UNBOUNDED_ARCHIVE_ENTRIES")
            path = PurePosixPath(info.name)
            if info.name.startswith("/") or "\\" in info.name or ".." in path.parts:
                raise ArchiveAuditError("UNSAFE_ARCHIVE_PATH")
            if info.issym() or info.islnk():
                symlinks += 1
                continue
            if info.name == "flat/manifest.json" and info.isfile():
                if info.size <= 0 or info.size > MAX_MANIFEST:
                    raise ArchiveAuditError("INVALID_SOURCE_MANIFEST_SIZE")
                try:
                    manifest = json.load(archive.extractfile(info))
                except (ValueError, UnicodeError) as exc:
                    raise ArchiveAuditError("INVALID_SOURCE_MANIFEST") from exc
            elif info.isfile() and PRIMARY.fullmatch(info.name):
                oid = PRIMARY.fullmatch(info.name).group(1)
                if oid in ids:
                    raise ArchiveAuditError("DUPLICATE_SOURCE_OBJECT_ID")
                ids.add(oid)
                if info.size < 20:
                    raise ArchiveAuditError("GLB_TRUNCATED")
                f = archive.extractfile(info)
                header = f.read(20)
                if (
                    len(header) != 20
                    or header[:4] != b"glTF"
                    or struct.unpack_from("<I", header, 4)[0] != 2
                    or struct.unpack_from("<I", header, 8)[0] != info.size
                    or struct.unpack_from("<I", header, 16)[0] != 0x4E4F534A
                ):
                    bad += 1
                else:
                    good += 1
    if not isinstance(manifest, dict):
        raise ArchiveAuditError("SOURCE_MANIFEST_MISSING")
    source = manifest.get("source", {})
    inp = manifest.get("input", {})
    if not isinstance(source, dict) or not isinstance(inp, dict):
        raise ArchiveAuditError("INVALID_SOURCE_INVENTORY")
    expected = source.get("sourceFeatureCount")
    height_sources = inp.get("heightSources", {})
    if (type(expected) is not int or expected <= 0
        or type(inp.get("featureCount")) is not int or type(inp.get("tileCount")) is not int
        or not isinstance(height_sources, dict)
        or any(type(height_sources.get(k)) is not int or height_sources[k] < 0
               for k in ("OBSERVED", "DERIVED", "ESTIMATED_FALLBACK_INFORMATIONAL_ONLY"))):
        raise ArchiveAuditError("INVALID_HEIGHT_SOURCE_COUNTS")
    if (bad > 0 or good != expected or good != inp["featureCount"] or
        good != inp["tileCount"] or
        sum(height_sources[k] for k in ("OBSERVED", "DERIVED", "ESTIMATED_FALLBACK_INFORMATIONAL_ONLY")) != good):
        raise ArchiveAuditError("SOURCE_MANIFEST_PRIMARY_GLB_COUNT_MISMATCH")
    return {
        "schemaVersion": "tsm.posey-archive-container-audit.v1",
        "tarEntriesInspected": count,
        "primaryGlbHeadersVerified": good,
        "primaryGlbHeadersRejected": bad,
        "distinctPrimaryObjectIds": len(ids),
        "unfollowedArchiveLinks": symlinks,
        "sourceFeatureCountDeclared": expected,
        "sourceClassCountsDeclared": height_sources,
        "inputGeojsonSha256Declared": inp.get("geojsonSha256"),
        "sourceAuthorityClass": manifest.get("authorityClass"),
        "fileIntegrityChecked": True,
        "fullGltfGeometryValidated": False,
        "independentObjectIdReconciliation": False,
        "independentHeightVerification": False,
        "independentHorizontalAndVerticalControlVerified": False,
        "regulatoryCertification": False,
        "nativeHeadedRuntimeVerified": False,
    }


def audit(archive: Path, expected_sha256: str) -> dict:
    if not isinstance(expected_sha256, str) or not SHA256.fullmatch(expected_sha256):
        raise ArchiveAuditError("EXPECTED_SHA256_REQUIRED")
    if archive.is_symlink() or not archive.is_file():
        raise ArchiveAuditError("ARCHIVE_MUST_BE_REGULAR_FILE")
    actual = sha256(archive)
    if actual != expected_sha256:
        raise ArchiveAuditError("ARCHIVE_BYTES_DO_NOT_MATCH_MANIFEST")
    try:
        proc = subprocess.Popen(
            ["zstd", "-dc", "--", str(archive)],
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
    except OSError as exc:
        raise ArchiveAuditError("ZSTD_DECOMPRESSOR_UNAVAILABLE") from exc
    try:
        try:
            result = inspect_tar(proc.stdout)
        except (tarfile.TarError, OSError) as exc:
            raise ArchiveAuditError("INVALID_TAR_STREAM") from exc
        err = proc.stderr.read(8192)
        status = proc.wait(timeout=30)
        if status != 0:
            raise ArchiveAuditError("ZSTD_DECOMPRESSION_FAILED: " + err.decode(errors="replace")[:180])
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait()
        proc.stdout.close()
        proc.stderr.close()
    return {
        "archiveSha256Verified": actual,
        "archiveSizeBytes": archive.stat().st_size,
        **result,
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--archive", type=Path, required=True)
    p.add_argument("--expected-sha256", required=True)
    p.add_argument("--output", type=Path)
    args = p.parse_args()
    try:
        receipt = audit(args.archive, args.expected_sha256)
        payload = json.dumps(receipt, sort_keys=True, indent=2) + "\n"
        if args.output:
            if args.output.is_symlink() or args.output.exists() or not args.output.parent.is_dir():
                raise ArchiveAuditError("OUTPUT_MUST_BE_NEW_FILE_IN_EXISTING_DIRECTORY")
            args.output.write_text(payload, encoding="utf-8")
        else:
            print(payload, end="")
    except (ArchiveAuditError, OSError) as exc:
        p.error(str(exc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
