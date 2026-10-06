#!/usr/bin/env python3
"""Stitch building GLBs per HLOD leaf node into merged tile GLBs.

Takes a hierarchical tileset where leaf parents have N building children,
merges each leaf's buildings into a single GLB, and updates the tileset
so leaf nodes reference the merged file directly.

This reduces HTTP requests from 4,121 (one per building) to ~115
(one per leaf tile).

Usage:
  python3 stitch-building-glbs.py --tileset <in.json> --tiles-dir <dir> --output <out.json>
"""
from __future__ import annotations

import argparse
import copy
import json
import struct
from pathlib import Path

import numpy as np


def load_glb(path: Path):
    """Load GLB, return (json_dict, binary_data)."""
    with open(path, 'rb') as f:
        magic = f.read(4)
        assert magic == b'glTF', f"Bad magic in {path}"
        version = struct.unpack('<I', f.read(4))[0]
        assert version == 2
        total_len = struct.unpack('<I', f.read(4))[0]

        json_len = struct.unpack('<I', f.read(4))[0]
        json_type = f.read(4)
        assert json_type == b'JSON'
        json_data = json.loads(f.read(json_len))

        # Skip padding
        pos = 12 + 8 + json_len
        if json_len % 4:
            pos += 4 - (json_len % 4)

        f.seek(pos)
        bin_len = struct.unpack('<I', f.read(4))[0]
        bin_type = f.read(4)
        assert bin_type == b'BIN\x00'
        bin_data = f.read(bin_len)

    return json_data, bin_data


def get_accessor_data(json_data, bin_data, accessor_idx):
    """Extract accessor data as numpy array."""
    acc = json_data['accessors'][accessor_idx]
    bv = json_data['bufferViews'][acc['bufferView']]
    byte_offset = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
    count = acc['count']
    comp_type = acc['componentType']
    type_str = acc['type']

    dtype_map = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
    type_count = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[type_str]
    dtype = np.dtype(dtype_map[comp_type])

    arr = np.frombuffer(bin_data, dtype=dtype, count=count * type_count,
                        offset=byte_offset)
    return arr.reshape(count, type_count) if type_count > 1 else arr


def merge_glbs(glb_paths: list[Path], output_path: Path):
    """Merge multiple GLBs (each 1 mesh) into a single GLB."""
    all_positions = []
    all_indices = []
    all_colors = []
    vertex_offset = 0

    for glb_path in glb_paths:
        jd, bd = load_glb(glb_path)
        mesh = jd['meshes'][0]['primitives'][0]
        attrs = mesh['attributes']

        pos = get_accessor_data(jd, bd, attrs['POSITION'])

        # Indices may be absent (non-indexed geometry)
        if 'indices' in mesh:
            idx = get_accessor_data(jd, bd, mesh['indices'])
        else:
            # Generate sequential indices for non-indexed
            idx = np.arange(len(pos), dtype=np.uint32)

        all_positions.append(pos)
        all_indices.append(idx.astype(np.uint32) + vertex_offset)
        vertex_offset += len(pos)

        # Color (may be VEC3 or VEC4)
        if 'COLOR_0' in attrs:
            col = get_accessor_data(jd, bd, attrs['COLOR_0'])
            all_colors.append(col)

    positions = np.vstack(all_positions).astype(np.float32)
    indices = np.concatenate(all_indices).astype(np.uint32)

    # Build merged GLB
    # Buffer: positions + indices (+ colors if present)
    pos_bytes = positions.tobytes()
    # Pad to 4-byte alignment
    while len(pos_bytes) % 4:
        pos_bytes += b'\x00'

    idx_bytes = indices.tobytes()
    while len(idx_bytes) % 4:
        idx_bytes += b'\x00'

    buffer_views = [
        {'buffer': 0, 'byteOffset': 0, 'byteLength': len(pos_bytes),
         'target': 34962},  # ARRAY_BUFFER
        {'buffer': 0, 'byteOffset': len(pos_bytes), 'byteLength': len(idx_bytes),
         'target': 34963},  # ELEMENT_ARRAY_BUFFER
    ]

    accessors = [
        {'bufferView': 0, 'componentType': 5126, 'count': len(positions),
         'type': 'VEC3',
         'min': positions.min(axis=0).tolist(),
         'max': positions.max(axis=0).tolist()},
        {'bufferView': 1, 'componentType': 5125, 'count': len(indices),
         'type': 'SCALAR'},
    ]

    bin_data = pos_bytes + idx_bytes

    # Handle colors if present
    if all_colors and len(all_colors) == len(glb_paths):
        colors = np.vstack(all_colors).astype(np.float32)
        col_bytes = colors.tobytes()
        while len(col_bytes) % 4:
            col_bytes += b'\x00'
        col_offset = len(bin_data)
        bin_data += col_bytes
        buffer_views.append(
            {'buffer': 0, 'byteOffset': col_offset, 'byteLength': len(col_bytes),
             'target': 34962})
        accessors.append(
            {'bufferView': 2, 'componentType': 5126, 'count': len(colors),
             'type': f'VEC{colors.shape[1]}'})
        color_acc_idx = 2
    else:
        color_acc_idx = None

    attributes = {'POSITION': 0}
    if color_acc_idx is not None:
        attributes['COLOR_0'] = color_acc_idx

    gltf = {
        'asset': {'version': '2.0', 'generator': 'TSM GLB stitcher v1'},
        'buffers': [{'byteLength': len(bin_data)}],
        'bufferViews': buffer_views,
        'accessors': accessors,
        'materials': [{'pbrMetallicRoughness': {}}],
        'meshes': [{
            'primitives': [{
                'attributes': attributes,
                'indices': 1,
                'material': 0,
                'mode': 4,  # TRIANGLES
            }]
        }],
        'nodes': [{'mesh': 0}],
        'scenes': [{'nodes': [0]}],
        'scene': 0,
    }

    json_str = json.dumps(gltf, separators=(',', ':'))
    json_bytes = json_str.encode('utf-8')
    while len(json_bytes) % 4:
        json_bytes += b' '

    total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_data)

    with open(output_path, 'wb') as f:
        f.write(b'glTF')
        f.write(struct.pack('<I', 2))
        f.write(struct.pack('<I', total_len))
        f.write(struct.pack('<I', len(json_bytes)))
        f.write(b'JSON')
        f.write(json_bytes)
        f.write(struct.pack('<I', len(bin_data)))
        f.write(b'BIN\x00')
        f.write(bin_data)

    return output_path.stat().st_size


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--tileset', required=True, type=Path)
    p.add_argument('--tiles-dir', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    p.add_argument('--stitched-dir', type=Path, default=None,
                   help='Output dir for stitched GLBs (default: <tiles-dir>/stitched)')
    args = p.parse_args()

    tiles_dir = args.tiles_dir
    stitched_dir = args.stitched_dir or (tiles_dir / 'stitched')
    stitched_dir.mkdir(exist_ok=True)

    with open(args.tileset) as f:
        ts = json.load(f)

    stitched_count = 0
    total_before = 0
    total_after = 0

    def process(node, tile_id=[0]):
        nonlocal stitched_count, total_before, total_after
        children = node.get('children', [])

        # Leaf parent: children are buildings (have content)
        if children and 'content' in children[0]:
            # Collect GLB paths
            glb_paths = []
            for child in children:
                uri = child['content']['uri']
                glb_path = tiles_dir / uri
                if glb_path.exists():
                    glb_paths.append(glb_path)
                    total_before += glb_path.stat().st_size

            if glb_paths:
                tile_id[0] += 1
                out_name = f"tile-{tile_id[0]:04d}.glb"
                out_path = stitched_dir / out_name
                size = merge_glbs(glb_paths, out_path)
                total_after += size
                stitched_count += 1

                # Replace children with single content reference
                # Compute merged bounding volume from children
                node['content'] = {'uri': f"stitched/{out_name}"}
                del node['children']
                print(f"  Stitched {len(glb_paths)} → {out_name} ({size/1024:.1f} KB)")
        else:
            for child in children:
                process(child, tile_id)

    print("Stitching leaf nodes...")
    process(ts['root'])

    with open(args.output, 'w') as f:
        json.dump(ts, f, separators=(',', ':'))

    print(f"\nStitched {stitched_count} tiles")
    print(f"Before: {total_before/1024/1024:.1f} MB, After: {total_after/1024/1024:.1f} MB")
    print(f"Wrote: {args.output}")


if __name__ == '__main__':
    main()
