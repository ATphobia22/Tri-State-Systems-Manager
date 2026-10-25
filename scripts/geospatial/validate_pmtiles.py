#!/usr/bin/env python3
"""Validate PMTiles v3 header bounds before a tile archive is published.

This checks structural header integrity, not every compressed directory/tile.
For full archive validation, also read the archive with a PMTiles-spec reader.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path
from typing import Any

HEADER_SIZE = 127
MAGIC = b"PMTiles"
MAX_ROOT_DIRECTORY_END = 16_384
COMPRESSION_VALUES = {0, 1, 2, 3, 4}
TILE_TYPE_VALUES = {0, 1, 2, 3, 4, 5, 6}


def read_u64(header: bytes, offset: int) -> int:
    return struct.unpack_from("<Q", header, offset)[0]


def parse_header(path: Path) -> dict[str, Any]:
    size = path.stat().st_size
    if size < HEADER_SIZE:
        raise ValueError(f"archive is shorter than the {HEADER_SIZE}-byte PMTiles header")
    with path.open("rb") as stream:
        header = stream.read(HEADER_SIZE)
    if header[:7] != MAGIC:
        raise ValueError("invalid PMTiles magic bytes")
    if header[7] != 3:
        raise ValueError(f"unsupported PMTiles version: {header[7]} (expected v3)")

    root_offset, root_length = read_u64(header, 8), read_u64(header, 16)
    metadata_offset, metadata_length = read_u64(header, 24), read_u64(header, 32)
    leaf_offset, leaf_length = read_u64(header, 40), read_u64(header, 48)
    tile_offset, tile_length = read_u64(header, 56), read_u64(header, 64)
    min_zoom, max_zoom = header[100], header[101]
    compression = {
        "internal": header[97],
        "tile": header[98],
        "tile_type": header[99],
    }

    if root_length == 0:
        raise ValueError("root directory length must be non-zero")
    if root_offset < HEADER_SIZE:
        raise ValueError("root directory overlaps the header")
    if root_offset + root_length > size:
        raise ValueError("root directory extends beyond archive size")
    if root_offset + root_length > MAX_ROOT_DIRECTORY_END:
        raise ValueError("root directory is not contained within the first 16 KiB")
    if min_zoom > max_zoom or max_zoom > 30:
        raise ValueError(f"invalid zoom range: {min_zoom}..{max_zoom}")
    if compression["internal"] not in COMPRESSION_VALUES:
        raise ValueError(f"unknown internal compression enum: {compression['internal']}")
    if compression["tile"] not in COMPRESSION_VALUES:
        raise ValueError(f"unknown tile compression enum: {compression['tile']}")
    if compression["tile_type"] not in TILE_TYPE_VALUES:
        raise ValueError(f"unknown tile type enum: {compression['tile_type']}")

    sections = [
        ("root directory", root_offset, root_length),
        ("metadata", metadata_offset, metadata_length),
        ("leaf directories", leaf_offset, leaf_length),
        ("tile data", tile_offset, tile_length),
    ]
    nonempty = []
    for name, offset, length in sections:
        if length == 0:
            continue
        if offset < HEADER_SIZE:
            raise ValueError(f"{name} overlaps the header")
        if offset + length > size:
            raise ValueError(f"{name} extends beyond archive size")
        nonempty.append((offset, offset + length, name))
    nonempty.sort()
    for previous, current in zip(nonempty, nonempty[1:]):
        if previous[1] > current[0]:
            raise ValueError(f"{previous[2]} overlaps {current[2]}")

    hasher = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            hasher.update(chunk)
    digest = hasher.hexdigest()
    return {
        "path": str(path),
        "size_bytes": size,
        "sha256": digest,
        "version": header[7],
        "root_directory": {"offset": root_offset, "length": root_length},
        "metadata": {"offset": metadata_offset, "length": metadata_length},
        "leaf_directories": {"offset": leaf_offset, "length": leaf_length},
        "tile_data": {"offset": tile_offset, "length": tile_length},
        "min_zoom": min_zoom,
        "max_zoom": max_zoom,
        "addressed_tiles_count": read_u64(header, 72),
        "tile_entries_count": read_u64(header, 80),
        "tile_contents_count": read_u64(header, 88),
        "internal_compression": compression["internal"],
        "tile_compression": compression["tile"],
        "tile_type": compression["tile_type"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="PMTiles v3 archive")
    parser.add_argument("--expected-minzoom", type=int)
    parser.add_argument("--expected-maxzoom", type=int)
    parser.add_argument("--expected-sha256", help="Optional independently recorded SHA-256")
    parser.add_argument("--json", action="store_true", help="Emit a machine-readable report")
    args = parser.parse_args()

    try:
        report = parse_header(args.archive)
        if args.expected_minzoom is not None and report["min_zoom"] != args.expected_minzoom:
            raise ValueError(f"min zoom mismatch: expected {args.expected_minzoom}, found {report['min_zoom']}")
        if args.expected_maxzoom is not None and report["max_zoom"] != args.expected_maxzoom:
            raise ValueError(f"max zoom mismatch: expected {args.expected_maxzoom}, found {report['max_zoom']}")
        if args.expected_sha256 and report["sha256"].lower() != args.expected_sha256.lower():
            raise ValueError("archive SHA-256 does not match expected digest")
    except (OSError, ValueError) as error:
        print(f"FAIL PMTiles validation: {error}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print(
            f"PASS PMTiles v{report['version']}: {report['size_bytes']} bytes; "
            f"zoom {report['min_zoom']}..{report['max_zoom']}; "
            f"sha256={report['sha256']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
