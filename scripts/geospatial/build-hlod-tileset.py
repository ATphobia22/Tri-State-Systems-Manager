#!/usr/bin/env python3
"""
TSM 3D Tiles HLOD Pipeline: GLB/glTF → Spatial Partitioning → 3D Tiles → Streaming

Pipeline stages:
  1. GLB/glTF (input): Individual building models (LOD1 extruded prisms)
  2. Spatial partitioning / HLOD: Quadtree subdivision for hierarchical LOD
  3. 3D Tiles: OGC 3D Tiles 1.1 tileset.json with hierarchical bounding volumes
  4. Tile-level streaming: Client fetches only visible tiles via HTTP range requests
  5. Renderers: Three.js (3d-tiles-renderer), CesiumJS, Unreal (Cesium for Unreal)

Usage:
  python3 build-hlod-tileset.py --input <flat-tileset.json> --output <hlod-tileset.json>

The input is a flat tileset (root with N children, one per building).
The output is a hierarchical tileset with quadtree intermediate nodes.

HLOD strategy:
  - Quadtree subdivision on XY plane (local ENU coordinates)
  - Max 50 buildings per leaf node, max depth 6
  - Geometric error halves at each depth level (1000 / 2^depth)
  - Refine mode: ADD (additive refinement for buildings)
  - Intermediate nodes have bounding volumes but no content (pure spatial index)
  - Leaf nodes contain the actual building GLB references

This enables:
  - Frustum culling: skip entire subtrees outside view
  - LOD selection: load coarse nodes first, refine as camera approaches
  - Tile-level streaming: HTTP/2 multiplexed tile fetches
  - Memory efficiency: only visible tiles in GPU memory
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


class QuadtreeNode:
    """Spatial partition node for HLOD hierarchy."""

    def __init__(self, items, depth=0, max_items=50, max_depth=6):
        self.items = items
        self.depth = depth
        self.children = []

        xs = [i['x'] for i in items]
        ys = [i['y'] for i in items]
        zs = [i['z'] for i in items]
        self.minx, self.maxx = min(xs), max(xs)
        self.miny, self.maxy = min(ys), max(ys)
        self.minz, self.maxz = min(zs), max(zs)

        if len(items) > max_items and depth < max_depth:
            midx = (self.minx + self.maxx) / 2
            midy = (self.miny + self.maxy) / 2
            quadrants = [[], [], [], []]
            for item in items:
                qx = 0 if item['x'] < midx else 1
                qy = 0 if item['y'] < midy else 1
                quadrants[qy * 2 + qx].append(item)
            for q in quadrants:
                if q:
                    self.children.append(QuadtreeNode(q, depth + 1, max_items, max_depth))

    def to_tileset(self, geometric_error_base=1000.0):
        """Convert to 3D Tiles 1.1 JSON node."""
        cx = (self.minx + self.maxx) / 2
        cy = (self.miny + self.maxy) / 2
        cz = (self.minz + self.maxz) / 2
        hx = (self.maxx - self.minx) / 2 + 10
        hy = (self.maxy - self.miny) / 2 + 10
        hz = (self.maxz - self.minz) / 2 + 10

        ge = geometric_error_base / (2 ** self.depth)

        result = {
            'boundingVolume': {
                'box': [cx, cy, cz, hx, 0, 0, 0, hy, 0, 0, 0, hz]
            },
            'geometricError': ge,
            'refine': 'ADD',
        }

        if self.children:
            result['children'] = [c.to_tileset(geometric_error_base) for c in self.children]
        else:
            result['children'] = [item['tile'] for item in self.items]

        return result


def build_hlod(input_path: Path, output_path: Path, max_items=50, max_depth=6):
    """Build HLOD tileset from flat tileset."""
    with open(input_path) as f:
        ts = json.load(f)

    children = ts['root']['children']
    print(f"Building HLOD for {len(children)} tiles...")

    items = []
    for c in children:
        bv = c['boundingVolume']['box']
        items.append({'x': bv[0], 'y': bv[1], 'z': bv[2], 'tile': c})

    root_node = QuadtreeNode(items, max_items=max_items, max_depth=max_depth)

    def count(n):
        return 1 + sum(count(c) for c in n.children)
    print(f"Intermediate nodes: {count(root_node)}")

    new_root = root_node.to_tileset()
    new_ts = {
        'asset': ts['asset'],
        'geometricError': ts['root']['geometricError'],
        'root': new_root
    }

    with open(output_path, 'w') as f:
        json.dump(new_ts, f, separators=(',', ':'))

    print(f"Wrote: {output_path} ({output_path.stat().st_size / 1024:.1f} KB)")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input', required=True, help='Flat tileset.json input')
    p.add_argument('--output', required=True, help='HLOD tileset.json output')
    p.add_argument('--max-items', type=int, default=50, help='Max tiles per leaf')
    p.add_argument('--max-depth', type=int, default=6, help='Max quadtree depth')
    args = p.parse_args()
    build_hlod(Path(args.input), Path(args.output), args.max_items, args.max_depth)


if __name__ == '__main__':
    main()
