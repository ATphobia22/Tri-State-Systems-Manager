#!/usr/bin/env python3
"""Deterministic, bounded-memory TSM offline asset bundles.

Never store raw LiDAR, large compressed GLBs or Unreal Shipping binaries
directly in the source tree. Publish verified parts as Actions/Release assets.
The manifest inventories exact original bytes, with independent SHA-256 checks
over each part, the complete archive, and every restored source asset.

No lossy vector quantization is applied to survey/evidence coordinates.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import os
import re
import shutil
import tarfile
import tempfile
from pathlib import Path, PurePosixPath

DEFAULT_PART_BYTES = 24 * 1024 * 1024
PART_RE = re.compile(r"part-[0-9]{6}[.]bin\Z")
HASH_RE = re.compile(r"[0-9a-f]{64}\Z")
SCHEMA = "tsm.offline-chunk-bundle.v1"


def fail(message: str):
    raise ValueError(message)


def hash_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def source_files(root: Path) -> list[tuple[str, Path]]:
    if not root.is_dir() or root.is_symlink():
        fail("Input must be a real directory")
    result = []
    for current, dirs, files in os.walk(root, followlinks=False):
        base = Path(current)
        for name in sorted(dirs):
            if (base / name).is_symlink():
                fail("Input may not contain symlink directories")
        for name in sorted(files):
            path = base / name
            if not path.is_file() or path.is_symlink():
                fail("Input may contain only regular files; no symlinks")
            relative = path.relative_to(root).as_posix()
            if not relative or relative.startswith("/") or ".." in PurePosixPath(relative).parts:
                fail("Unsafe archive-relative path")
            result.append((relative, path))
    result.sort(key=lambda x: x[0])
    if not result:
        fail("Input contains no files")
    return result


class ChunkWriter:
    def __init__(self, output: Path, limit: int):
        self.output = output
        self.limit = limit
        self.parts = []
        self.handle = None
        self.part_size = 0
        self.part_hash = hashlib.sha256()
        self.archive_hash = hashlib.sha256()
        self.archive_bytes = 0

    def writable(self):
        return True

    def flush(self):
        if self.handle:
            self.handle.flush()

    def _start(self):
        if len(self.parts) >= 999999:
            fail("Part count exceeds fixed-width manifest format")
        name = f"part-{len(self.parts) + 1:06d}.bin"
        self.handle = (self.output / name).open("xb")
        self.part_size = 0
        self.part_hash = hashlib.sha256()
        self.parts.append({"name": name})

    def _finish(self):
        if self.handle is not None:
            self.handle.close()
            self.parts[-1]["bytes"] = self.part_size
            self.parts[-1]["sha256"] = self.part_hash.hexdigest()
            self.handle = None

    def write(self, data):
        data = memoryview(data)
        count = len(data)
        offset = 0
        while offset < count:
            if self.handle is None:
                self._start()
            take = min(count - offset, self.limit - self.part_size)
            block = data[offset:offset + take]
            self.handle.write(block)
            self.archive_hash.update(block)
            self.part_hash.update(block)
            self.archive_bytes += take
            self.part_size += take
            offset += take
            if self.part_size == self.limit:
                self._finish()
        return count

    def close(self):
        self._finish()


class ChunkReader:
    """Sequential reader, suitable for tarfile streaming and gzip decompression."""
    def __init__(self, root: Path, parts: list[dict]):
        self.root = root
        self.parts = parts
        self.index = 0
        self.handle = None

    def read(self, size=-1):
        if size is None or size < 0:
            return b"".join(iter(lambda: self.read(1024 * 1024), b""))
        if size == 0:
            return b""
        blocks = []
        remaining = size
        while remaining:
            if self.handle is None:
                if self.index >= len(self.parts):
                    break
                self.handle = (self.root / self.parts[self.index]["name"]).open("rb")
                self.index += 1
            block = self.handle.read(remaining)
            if not block:
                self.handle.close()
                self.handle = None
                continue
            blocks.append(block)
            remaining -= len(block)
        return b"".join(blocks)

    def close(self):
        if self.handle:
            self.handle.close()
            self.handle = None


def pack(root: Path, output: Path, limit: int, compression: str) -> dict:
    root, output = root.resolve(), output.resolve()
    if limit < 512 or limit > 64 * 1024 * 1024:
        fail("Part size must be between 512 bytes and 64 MiB")
    if compression not in ("none", "gzip"):
        fail("Compression must be none or gzip")
    if output == root or root in output.parents:
        fail("Output cannot be inside input directory")
    files = source_files(root)
    if output.exists() and any(output.iterdir()):
        fail("Output directory must be empty; existing evidence is immutable")
    output.mkdir(parents=True, exist_ok=True)
    inventory = [{"path": rel, "bytes": path.stat().st_size,
                  "sha256": hash_file(path)} for rel, path in files]
    writer = ChunkWriter(output, limit)
    try:
        if compression == "gzip":
            with gzip.GzipFile(filename="", mode="wb", fileobj=writer, mtime=0,
                               compresslevel=6) as gz:
                with tarfile.open(fileobj=gz, mode="w|", format=tarfile.PAX_FORMAT) as tar:
                    for rel, path in files:
                        info = tarfile.TarInfo(name=rel)
                        info.size = path.stat().st_size
                        info.mode, info.mtime = 0o644, 0
                        info.uid, info.gid, info.uname, info.gname = 0, 0, "", ""
                        with path.open("rb") as inp:
                            tar.addfile(info, inp)
        else:
            with tarfile.open(fileobj=writer, mode="w|", format=tarfile.PAX_FORMAT) as tar:
                for rel, path in files:
                    info = tarfile.TarInfo(name=rel)
                    info.size = path.stat().st_size
                    info.mode, info.mtime = 0o644, 0
                    info.uid, info.gid, info.uname, info.gname = 0, 0, "", ""
                    with path.open("rb") as inp:
                        tar.addfile(info, inp)
    finally:
        writer.close()
    manifest = {
        "schemaVersion": SCHEMA,
        "classification": "DERIVED",
        "engineeringUse": False,
        "regulatoryUse": False,
        "format": "tar",
        "compression": compression,
        "chunkLimitBytes": limit,
        "archiveBytes": writer.archive_bytes,
        "archiveSha256": writer.archive_hash.hexdigest(),
        "sourceFileCount": len(inventory),
        "sourceBytes": sum(item["bytes"] for item in inventory),
        "inventory": inventory,
        "parts": writer.parts,
    }
    (output / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest


def read_manifest(path: Path) -> dict:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != SCHEMA or manifest.get("format") != "tar":
        fail("Unknown chunk-bundle manifest")
    if manifest.get("compression") not in ("none", "gzip"):
        fail("Unsupported archive compression")
    if manifest.get("engineeringUse") is not False or manifest.get("regulatoryUse") is not False:
        fail("Offline bundle cannot claim regulatory or engineering certification")
    parts = manifest.get("parts")
    inventory = manifest.get("inventory")
    if not isinstance(parts, list) or not parts or not isinstance(inventory, list) or not inventory:
        fail("Manifest must contain parts and source inventory")
    if manifest.get("sourceFileCount") != len(inventory):
        fail("Source file count mismatch")
    names = [p.get("name") for p in parts]
    if names != [f"part-{i:06d}.bin" for i in range(1, len(parts) + 1)]:
        fail("Part names/order are invalid")
    paths = [item.get("path") for item in inventory]
    if paths != sorted(set(paths)):
        fail("Source inventory paths must be sorted, unique and valid")
    for item in inventory:
        path = item["path"]
        if not isinstance(path, str) or not path or "\\" in path or path.startswith("/") or \
                any(x in ("", ".", "..") for x in PurePosixPath(path).parts):
            fail("Unsafe inventory path")
        if not isinstance(item.get("bytes"), int) or item["bytes"] < 0 or \
                not isinstance(item.get("sha256"), str) or not HASH_RE.fullmatch(item["sha256"]):
            fail("Invalid inventory byte count or digest")
    if sum(item["bytes"] for item in inventory) != manifest.get("sourceBytes"):
        fail("Source byte total mismatch")
    if not isinstance(manifest.get("archiveSha256"), str) or \
            not HASH_RE.fullmatch(manifest["archiveSha256"]):
        fail("Invalid archive digest")
    if not isinstance(manifest.get("archiveBytes"), int) or manifest["archiveBytes"] <= 0:
        fail("Invalid archive size")
    return manifest


def verify(manifest_path: Path) -> dict:
    manifest_path = manifest_path.resolve()
    m = read_manifest(manifest_path)
    digest = hashlib.sha256()
    total = 0
    for part in m["parts"]:
        path = manifest_path.parent / part["name"]
        if not path.is_file() or path.is_symlink() or not PART_RE.fullmatch(part["name"]):
            fail("Missing or unsafe archive part")
        expected_bytes = part.get("bytes")
        expected_hash = part.get("sha256")
        if not isinstance(expected_bytes, int) or expected_bytes <= 0 or \
                not isinstance(expected_hash, str) or not HASH_RE.fullmatch(expected_hash):
            fail("Invalid part metadata")
        actual = hashlib.sha256()
        count = 0
        with path.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                actual.update(block)
                digest.update(block)
                count += len(block)
        if actual.hexdigest() != expected_hash or count != expected_bytes:
            fail(f"Part corrupted: {part['name']}")
        total += count
    if total != m["archiveBytes"] or digest.hexdigest() != m["archiveSha256"]:
        fail("Whole archive SHA-256/size mismatch")
    return m


def unpack(manifest_path: Path, destination: Path) -> dict:
    manifest_path = manifest_path.resolve()
    m = verify(manifest_path)
    destination = destination.resolve()
    if destination.exists():
        fail("Restore destination must not exist; refusing overwrite")
    destination.parent.mkdir(parents=True, exist_ok=True)
    reader = ChunkReader(manifest_path.parent, m["parts"])
    expected = {item["path"]: item for item in m["inventory"]}
    seen = set()
    with tempfile.TemporaryDirectory(prefix=".tsm-offline-restore-",
                                     dir=destination.parent) as tmp:
        staging = Path(tmp)
        try:
            with tarfile.open(fileobj=reader, mode="r|gz" if m["compression"] == "gzip" else "r|") as tar:
                for member in tar:
                    rel = member.name
                    if not member.isfile() or rel not in expected or rel in seen:
                        fail("Archive contains unexpected, duplicated or unsafe entry")
                    if member.size != expected[rel]["bytes"]:
                        fail("Archive member length mismatch")
                    target = staging.joinpath(*PurePosixPath(rel).parts)
                    if not target.resolve().is_relative_to(staging.resolve()):
                        fail("Unsafe extracted archive path")
                    target.parent.mkdir(parents=True, exist_ok=True)
                    source = tar.extractfile(member)
                    if source is None:
                        fail("Unreadable tar entry")
                    digest = hashlib.sha256()
                    length = 0
                    with target.open("xb") as out:
                        while True:
                            block = source.read(1024 * 1024)
                            if not block:
                                break
                            length += len(block)
                            digest.update(block)
                            out.write(block)
                    if length != expected[rel]["bytes"] or digest.hexdigest() != expected[rel]["sha256"]:
                        fail("Restored file checksum mismatch")
                    seen.add(rel)
        finally:
            reader.close()
        if seen != set(expected):
            fail("Bundle omitted required inventory files")
        staging.rename(destination)
    return m


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="action", required=True)
    build = commands.add_parser("pack", help="Stream input files to deterministic tar chunks")
    build.add_argument("--input-dir", type=Path, required=True)
    build.add_argument("--output-dir", type=Path, required=True)
    build.add_argument("--part-bytes", type=int, default=DEFAULT_PART_BYTES)
    build.add_argument("--compression", choices=("none", "gzip"), default="none")
    check = commands.add_parser("verify", help="Validate every chunk and complete archive hash")
    check.add_argument("--manifest", type=Path, required=True)
    restore = commands.add_parser("unpack", help="Verify and safely restore all original files")
    restore.add_argument("--manifest", type=Path, required=True)
    restore.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    if args.action == "pack":
        result = pack(args.input_dir, args.output_dir, args.part_bytes, args.compression)
    elif args.action == "verify":
        result = verify(args.manifest)
    else:
        result = unpack(args.manifest, args.output_dir)
    print(json.dumps({k: result[k] for k in
                      ("schemaVersion", "archiveSha256", "archiveBytes", "sourceFileCount",
                       "sourceBytes", "compression")}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
