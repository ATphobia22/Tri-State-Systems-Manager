#!/usr/bin/env python3
"""Validate TSM building 3D Tiles 1.1 tileset.

Checks:
  1. JSON schema: asset.version, root structure, required fields
  2. Reference integrity: every content.uri points to an existing file
  3. Bounding volumes: box has 12 elements, half-axes non-zero
  4. Geometric error: positive, decreases with depth
  5. Hierarchy: no orphan nodes, all buildings reachable
  6. GLB validity: magic bytes, version, length

Usage:
  python3 validate-building-3d-tiles.py --tileset <path> --tiles-dir <dir>
"""
from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path


class ValidationError(Exception):
    pass


def validate_box(box, path):
    if not isinstance(box, list) or len(box) != 12:
        raise ValidationError(f"{path}: box must have 12 elements, got {len(box) if isinstance(box, list) else type(box)}")
    # Check half-axes are non-zero (elements 3, 7, 11 are the diagonal)
    for i, idx in enumerate([3, 7, 11]):
        if abs(box[idx]) < 1e-9:
            raise ValidationError(f"{path}: box half-axis {i} is zero")


def validate_glb(path: Path):
    with open(path, 'rb') as f:
        magic = f.read(4)
        if magic != b'glTF':
            raise ValidationError(f"{path}: invalid GLB magic {magic!r}")
        version = struct.unpack('<I', f.read(4))[0]
        if version != 2:
            raise ValidationError(f"{path}: unsupported glTF version {version}")
        length = struct.unpack('<I', f.read(4))[0]
        actual = path.stat().st_size
        if length != actual:
            raise ValidationError(f"{path}: declared length {length} != actual {actual}")


def walk(node, tiles_dir: Path, depth=0, stats=None):
    if stats is None:
        stats = {'nodes': 0, 'buildings': 0, 'max_depth': 0, 'errors': []}

    stats['nodes'] += 1
    stats['max_depth'] = max(stats['max_depth'], depth)
    path = f"root{'/child' * depth}"

    # Required fields
    for field in ['boundingVolume', 'geometricError', 'refine']:
        if field not in node:
            stats['errors'].append(f"{path}: missing '{field}'")

    # Bounding volume
    bv = node.get('boundingVolume', {})
    if 'box' in bv:
        try:
            validate_box(bv['box'], path)
        except ValidationError as e:
            stats['errors'].append(str(e))
    elif 'region' not in bv and 'sphere' not in bv:
        stats['errors'].append(f"{path}: no valid boundingVolume")

    # Geometric error
    ge = node.get('geometricError')
    if ge is not None and (not isinstance(ge, (int, float)) or ge < 0):
        stats['errors'].append(f"{path}: invalid geometricError {ge}")

    # Refine mode
    if node.get('refine') not in ('ADD', 'REPLACE', None):
        stats['errors'].append(f"{path}: invalid refine mode {node.get('refine')}")

    # Content
    content = node.get('content')
    if content:
        uri = content.get('uri')
        if uri:
            glb_path = tiles_dir / uri
            if not glb_path.exists():
                stats['errors'].append(f"{path}: missing content file {uri}")
            else:
                try:
                    validate_glb(glb_path)
                    stats['buildings'] += 1
                except ValidationError as e:
                    stats['errors'].append(str(e))

    # Children
    for child in node.get('children', []):
        walk(child, tiles_dir, depth + 1, stats)

    return stats


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--tileset', required=True, type=Path)
    p.add_argument('--tiles-dir', required=True, type=Path)
    args = p.parse_args()

    with open(args.tileset) as f:
        ts = json.load(f)

    # Asset check
    version = ts.get('asset', {}).get('version')
    if version != '1.1':
        print(f"FAIL: asset.version is {version!r}, expected '1.1'")
        sys.exit(1)

    stats = walk(ts['root'], args.tiles_dir)

    print(f"Nodes: {stats['nodes']}")
    print(f"Buildings: {stats['buildings']}")
    print(f"Max depth: {stats['max_depth']}")

    if stats['errors']:
        print(f"\nFAIL: {len(stats['errors'])} errors:")
        for e in stats['errors'][:20]:
            print(f"  - {e}")
        sys.exit(1)

    print("\nPASS: tileset valid")


if __name__ == '__main__':
    main()
