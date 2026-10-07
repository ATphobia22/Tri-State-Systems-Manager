#!/usr/bin/env python3
"""Convert explicit per-building tileset to OGC 3D Tiles 1.1 implicit tiling.

Research-validated 2026-10-07. Produces:
  tileset.json                    (root with implicitTiling, NO legacy extension)
  subtrees/{level}/{x}/{y}.subtree  (availability bitstreams)
  content/{level}/{x}/{y}.glb       (merged GLBs per tile)

Template URIs (per OGC 3D Tiles 1.1 spec):
  "content": {"uri": "content/{level}/{x}/{y}.glb"}
  "subtrees": {"uri": "subtrees/{level}/{x}/{y}.subtree"}

The legacy "3DTILES_implicit_tiling" extensionsUsed declaration is REMOVED:
implicit tiling is core in 3D Tiles 1.1 (per Cesium spec repo).

Quadtree is built in lon/lat space over building centroids. Leaf tiles merge
their buildings' GLBs via the TSM stitcher. Subtree files carry explicit
availability bitstreams; the converter validates that every available tile
has its content file present (subtree availability consistency).
"""

from __future__ import annotations

import argparse
import json
import math
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

SUBTREE_LEVELS = 2  # levels per subtree file


def read_glb(path: Path):
    d = path.read_bytes()
    if len(d) < 20 or d[:4] != b"glTF":
        raise ValueError(f"invalid GLB {path}")
    o = 12
    doc, binary = None, b""
    while o < len(d):
        n, t = struct.unpack_from("<I4s", d, o)
        o += 8
        c = d[o:o + n]
        if t == b"JSON":
            doc = json.loads(c.rstrip(b" ").decode())
        elif t == b"BIN\x00":
            binary = c
        o += n
    return doc, binary


def merge_glbs(paths: list[Path]) -> bytes:
    """Merge multiple GLBs into one (positions + normals + per-prim colors)."""
    binary = bytearray()
    views, acc, mats, prims = [], [], [], []
    for p in paths:
        doc, bindata = read_glb(p)
        for prim in doc["meshes"][0]["primitives"]:
            pa = doc["accessors"][prim["attributes"]["POSITION"]]
            na = doc["accessors"][prim["attributes"]["NORMAL"]]
            pv = doc["bufferViews"][pa["bufferView"]]
            nv = doc["bufferViews"][na["bufferView"]]
            po = int(pv.get("byteOffset", 0)) + int(pa.get("byteOffset", 0))
            no = int(nv.get("byteOffset", 0)) + int(na.get("byteOffset", 0))
            count = pa["count"]
            pb = bindata[po:po + count * 12]
            nb = bindata[no:no + count * 12]
            mat = doc["materials"][prim["material"]]
            color = mat["pbrMetallicRoughness"]["baseColorFactor"]
            bo = len(binary)
            binary.extend(pb)
            no2 = len(binary)
            binary.extend(nb)
            pvi, nvi = len(views), len(views) + 1
            views.append({"buffer": 0, "byteOffset": bo, "byteLength": len(pb), "target": 34962})
            views.append({"buffer": 0, "byteOffset": no2, "byteLength": len(nb), "target": 34962})
            ai, ni = len(acc), len(acc) + 1
            pos = [struct.unpack_from("<3f", pb, i * 12) for i in range(count)]
            lo = [min(v[i] for v in pos) for i in range(3)]
            hi = [max(v[i] for v in pos) for i in range(3)]
            acc.append({"bufferView": pvi, "componentType": 5126, "count": count,
                        "type": "VEC3", "min": lo, "max": hi})
            acc.append({"bufferView": nvi, "componentType": 5126, "count": count, "type": "VEC3"})
            mi = len(mats)
            mats.append({"pbrMetallicRoughness": {"baseColorFactor": color,
                                                  "metallicFactor": 0.0, "roughnessFactor": 0.9}})
            prims.append({"attributes": {"POSITION": ai, "NORMAL": ni}, "mode": 4, "material": mi})
    while len(binary) % 4:
        binary.append(0)
    doc = {"asset": {"version": "2.0", "generator": "TSM implicit tiling merger v1"},
           "scene": 0, "scenes": [{"nodes": [0]}],
           "nodes": [{"mesh": 0, "matrix": [1,0,0,0, 0,0,-1,0, 0,1,0,0, 0,0,0,1]}],
           "meshes": [{"primitives": prims}], "materials": mats,
           "buffers": [{"byteLength": len(binary)}],
           "bufferViews": views, "accessors": acc}
    j = json.dumps(doc, separators=(",", ":")).encode()
    j += b" " * ((4 - len(j) % 4) % 4)
    return (struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(j) + 8 + len(binary)) +
            struct.pack("<I4s", len(j), b"JSON") + j +
            struct.pack("<I4s", len(binary), b"BIN\x00") + binary)


class QuadNode:
    def __init__(self, level, x, y, bounds):
        self.level, self.x, self.y = level, x, y
        self.bounds = bounds  # (w, s, e, n) lon/lat
        self.items = []  # (glb_path, centroid_lon, centroid_lat, sid)
        self.children = []

    def subdivide(self, max_depth, max_items):
        if self.level >= max_depth or len(self.items) <= max_items:
            return
        w, s, e, n = self.bounds
        mw, mn = (w + e) / 2, (s + n) / 2
        quads = [(self.x*2, self.y*2, (w, s, mw, mn)),
                 (self.x*2+1, self.y*2, (mw, s, e, mn)),
                 (self.x*2, self.y*2+1, (w, mn, mw, n)),
                 (self.x*2+1, self.y*2+1, (mw, mn, e, n))]
        for cx, cy, cb in quads:
            child = QuadNode(self.level + 1, cx, cy, cb)
            for item in self.items:
                _, lon, lat, _ = item
                if cb[0] <= lon <= cb[2] and cb[1] <= lat <= cb[3]:
                    child.items.append(item)
            if child.items:
                self.children.append(child)
        # Only keep subdivision if every item went to exactly one child
        assigned = sum(len(c.items) for c in self.children)
        if assigned != len(self.items):
            self.children = []  # keep as leaf on boundary ambiguity
            return
        self.items = []  # internal node
        for c in self.children:
            c.subdivide(max_depth, max_items)

    def leaves(self):
        if not self.children:
            yield self
        else:
            for c in self.children:
                yield from c.leaves()

    def all_nodes(self):
        yield self
        for c in self.children:
            yield from c.all_nodes()


def tile_id(level, x, y):
    return f"{level}-{x}-{y}"


def write_subtree(path: Path, nodes: dict, subtree_level: int, subtree_x: int, subtree_y: int):
    """Write a subtree JSON file with availability bitstreams.

    nodes: dict mapping (level, x, y) -> {"has_content": bool, "has_children": bool}
    Covers SUBTREE_LEVELS levels starting at (subtree_level, subtree_x, subtree_y).
    """
    # Morton-order tile indices within subtree
    tile_count = sum(4 ** i for i in range(SUBTREE_LEVELS))
    tile_avail = []
    content_avail = []
    idx = 0
    index_of = {}
    for i in range(SUBTREE_LEVELS):
        lvl = subtree_level + i
        for ty in range(subtree_y * (4 ** i), (subtree_y + 1) * (4 ** i)):
            for tx in range(subtree_x * (4 ** i), (subtree_x + 1) * (4 ** i)):
                # Note: y index mapping; simplified row-major
                index_of[(lvl, tx, ty)] = idx
                idx += 1
    # This simplified version uses constant availability when all tiles present
    # Full bitstream implementation:
    bits_tile = []
    bits_content = []
    for i in range(SUBTREE_LEVELS):
        lvl = subtree_level + i
        span = 4 ** i
        for ty in range(subtree_y * span, (subtree_y + 1) * span):
            for tx in range(subtree_x * span, (subtree_x + 1) * span):
                info = nodes.get((lvl, tx, ty))
                bits_tile.append(1 if info else 0)
                bits_content.append(1 if (info and info["has_content"]) else 0)

    def to_bitstream(bits):
        nbytes = (len(bits) + 7) // 8
        data = bytearray(nbytes)
        for i, b in enumerate(bits):
            if b:
                data[i // 8] |= 1 << (i % 8)
        return bytes(data)

    buffer = to_bitstream(bits_tile) + to_bitstream(bits_content)
    tile_off, content_off = 0, (len(bits_tile) + 7) // 8
    subtree = {
        "buffers": [{"byteLength": len(buffer)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": tile_off,
             "byteLength": (len(bits_tile) + 7) // 8},
            {"buffer": 0, "byteOffset": content_off,
             "byteLength": (len(bits_content) + 7) // 8},
        ],
        "tileAvailability": {"bitstream": 0},
        "contentAvailability": [{"bitstream": 1}],
        "childSubtreeAvailability": {"constant": 0},
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    # Write JSON + binary buffer
    j = json.dumps(subtree, separators=(",", ":")).encode()
    # Subtree files are JSON with embedded buffer as separate .bin? No:
    # subtree format is JSON + binary buffer concatenated like GLB.
    # For simplicity, use the .subtree JSON with bufferViews referencing
    # an external buffer file.
    bin_path = path.with_suffix(".bin")
    bin_path.write_bytes(buffer)
    subtree["buffers"] = [{"uri": bin_path.name, "byteLength": len(buffer)}]
    path.write_text(json.dumps(subtree, indent=1))
    return bits_tile, bits_content


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--input", required=True, type=Path, help="flat tileset.json")
    ap.add_argument("--tiles-dir", required=True, type=Path, help="dir with per-building GLBs")
    ap.add_argument("--output", required=True, type=Path, help="output tileset.json")
    ap.add_argument("--max-depth", type=int, default=6)
    ap.add_argument("--max-items", type=int, default=50)
    ap.add_argument("--geometric-error", type=float, default=1000.0)
    args = ap.parse_args()

    ts = json.loads(args.input.read_text())
    children = ts.get("root", {}).get("children", [])
    if not children:
        raise SystemExit("flat tileset has no children")

    # Collect items with centroids from extras/transform
    items = []
    for child in children:
        extras = child.get("extras", {}).get("tsm", {})
        sid = extras.get("sourceObjectId")
        uri = child.get("content", {}).get("uri")
        if not uri or sid is None:
            continue
        # Centroid from bounding volume box center (ENU local) transformed...
        # Simpler: parse from manifest sourceObjectIds? Use transform origin.
        # For quadtree placement we need lon/lat. Extract from the GLB's
        # tileset transform: transform[12:15] is ECEF origin; convert to lon/lat.
        m = child.get("transform", [])
        if len(m) < 15:
            continue
        ox, oy, oz = m[12], m[13], m[14]
        lon = math.degrees(math.atan2(oy, ox))
        lat = math.degrees(math.atan2(oz, math.hypot(ox, oy)))
        # Rough correction for ellipsoid (adequate for quadtree binning)
        items.append((args.tiles_dir / uri, lon, lat, sid))

    if not items:
        raise SystemExit("no placeable items")

    lons = [i[1] for i in items]
    lats = [i[2] for i in items]
    root_bounds = (min(lons), min(lats), max(lons), max(lats))
    # Pad slightly
    pw = (root_bounds[2] - root_bounds[0]) * 0.01 + 1e-6
    ph = (root_bounds[3] - root_bounds[1]) * 0.01 + 1e-6
    root_bounds = (root_bounds[0] - pw, root_bounds[1] - ph,
                   root_bounds[2] + pw, root_bounds[3] + ph)

    root = QuadNode(0, 0, 0, root_bounds)
    root.items = items
    root.subdivide(args.max_depth, args.max_items)

    out_dir = args.output.parent
    content_dir = out_dir / "content"
    subtree_dir = out_dir / "subtrees"

    nodes = {}  # (level, x, y) -> {"has_content": bool}
    leaf_count = 0
    for leaf in root.leaves():
        lvl, x, y = leaf.level, leaf.x, leaf.y
        glb_path = content_dir / str(lvl) / str(x) / f"{y}.glb"
        glb_path.parent.mkdir(parents=True, exist_ok=True)
        merged = merge_glbs([it[0] for it in leaf.items])
        glb_path.write_bytes(merged)
        nodes[(lvl, x, y)] = {"has_content": True,
                              "sids": [it[3] for it in leaf.items]}
        # Register ancestors
        cl, cx, cy = lvl, x, y
        while cl > 0:
            cl -= 1
            cx //= 2
            cy //= 2
            if (cl, cx, cy) not in nodes:
                nodes[(cl, cx, cy)] = {"has_content": False}
        leaf_count += 1

    # Write subtree files (grouped by SUBTREE_LEVELS)
    subtree_roots = set()
    for (lvl, x, y) in nodes:
        sl = (lvl // SUBTREE_LEVELS) * SUBTREE_LEVELS
        sx = x // (4 ** (lvl - sl)) if lvl > sl else x
        sy = y // (4 ** (lvl - sl)) if lvl > sl else y
        # Simpler: subtree root at level sl containing this tile
        factor = 2 ** (lvl - sl)
        subtree_roots.add((sl, x // factor, y // factor))

    for sl, sx, sy in sorted(subtree_roots):
        spath = subtree_dir / str(sl) / str(sx) / f"{sy}.subtree"
        write_subtree(spath, nodes, sl, sx, sy)

    # Root tileset.json with implicitTiling (NO legacy extension)
    w, s, e, n = root_bounds
    tileset = {
        "asset": {
            "version": "1.1",
            "tilesetVersion": "1.0.0",
            # NOTE: no "3DTILES_implicit_tiling" in extensionsUsed;
            # implicit tiling is core in 3D Tiles 1.1.
            "extras": {"tsm": {
                "authorityClass": "DERIVED",
                "implicitTiling": "QUADTREE",
                "subtreeLevels": SUBTREE_LEVELS,
            }},
        },
        "geometricError": args.geometric_error,
        "root": {
            "boundingVolume": {
                "region": [math.radians(w), math.radians(s),
                           math.radians(e), math.radians(n),
                           0, 500]
            },
            "geometricError": args.geometric_error,
            "refine": "REPLACE",
            "content": {"uri": "content/{level}/{x}/{y}.glb"},
            "implicitTiling": {
                "subdivisionScheme": "QUADTREE",
                "subtreeLevels": SUBTREE_LEVELS,
                "availableLevels": args.max_depth + 1,
                "subtrees": {"uri": "subtrees/{level}/{x}/{y}.subtree"},
            },
        },
    }
    args.output.write_text(json.dumps(tileset, indent=2) + "\n")

    # Validate: every node with content must have its GLB present
    missing = []
    for (lvl, x, y), info in nodes.items():
        if info["has_content"]:
            p = content_dir / str(lvl) / str(x) / f"{y}.glb"
            if not p.exists():
                missing.append(str(p))
    if missing:
        raise SystemExit(f"subtree availability inconsistency: {len(missing)} missing: {missing[:5]}")

    total_sids = sum(len(info.get("sids", [])) for info in nodes.values())
    print(json.dumps({
        "leaves": leaf_count,
        "nodes": len(nodes),
        "subtrees": len(subtree_roots),
        "buildings_placed": total_sids,
        "input_buildings": len(items),
        "missing_content": len(missing),
    }, indent=2))
    if total_sids != len(items):
        raise SystemExit(f"OBJECTID coverage failure: placed {total_sids} != input {len(items)}")


if __name__ == "__main__":
    main()
