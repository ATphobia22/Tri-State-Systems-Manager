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

The quadtree partitions full building bounds in the source root frame.
Buildings that cross a split stay at the parent with additive refinement.
"""

from __future__ import annotations

import argparse
import json
import math
import struct
import sys
from pathlib import Path
from typing import NamedTuple

sys.path.insert(0, str(Path(__file__).resolve().parent))

from validate_spatial_coherence import aabb, box_corners

SUBTREE_LEVELS = 2  # levels per subtree file
IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
# Column-major matrices for the glTF Y-up and 3D Tiles Z-up conventions.
GLTF_TO_TILE = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1]
TILE_TO_GLTF = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1]

# Presentation-only baseline: B=1, D=1, C=1, T=3, S=1, R=0.
# This does not assert hydraulic meaning or a measured source LOD.
STATE_WORD_SCHEMA = "tsm-visual-state-word-v1"
DEFAULT_STATE_WORD = 0x52C8



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


def matmul(a: list[float], b: list[float]) -> list[float]:
    """Multiply column-major 4x4 matrices."""
    return [sum(a[k * 4 + row] * b[col * 4 + k] for k in range(4)) for col in range(4) for row in range(4)]


def transform_point(matrix: list[float], point: tuple[float, float, float]) -> tuple[float, float, float]:
    x, y, z = point
    return (
        matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
        matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
        matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
    )


def transform_normal(matrix: list[float], normal: tuple[float, float, float]) -> tuple[float, float, float]:
    x, y, z = normal
    transformed = (
        matrix[0] * x + matrix[4] * y + matrix[8] * z,
        matrix[1] * x + matrix[5] * y + matrix[9] * z,
        matrix[2] * x + matrix[6] * y + matrix[10] * z,
    )
    length = math.sqrt(sum(v * v for v in transformed))
    if not math.isfinite(length) or length <= 1e-12:
        raise ValueError("transformed GLB normal is degenerate")
    return tuple(v / length for v in transformed)


def validate_state_word(value: object) -> int:
    """Validate the current TSM visual-state schema (uint16, reserved bits fail closed)."""
    if isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > 0xFFFF:
        raise ValueError(f"state word must be an unsigned 16-bit integer, got {value!r}")
    fields = {
        "B": (value >> 14) & 0x3,
        "D": (value >> 12) & 0x3,
        "C": (value >> 9) & 0x7,
        "T": (value >> 6) & 0x7,
        "S": (value >> 3) & 0x7,
    }
    reserved = {name: level for name, level in fields.items() if level > 3}
    extension = value & 0x7
    if reserved or extension > 1:
        raise ValueError(f"reserved state-word pattern: fields={reserved}, R={extension}")
    return value


def merge_glbs(features: list[tuple[Path, int] | tuple[Path, int, list[float]] | tuple[Path, int, list[float], int]]) -> bytes:
    """Merge GLBs and preserve feature metadata; two-tuples use an identity transform.

    Each optional matrix maps the source glTF frame to the merged glTF frame.
    Each property-table row carries a presentation-only StateWord. Callers may
    supply it as the fourth tuple element; legacy callers receive the published
    TSM baseline profile, not inferred engineering/hydraulic semantics.
    """
    binary = bytearray()
    views, acc, mats, prims = [], [], [], []
    object_ids: list[int] = []
    state_words: list[int] = []
    for feature_index, feature in enumerate(features):
        if not isinstance(feature, (tuple, list)) or len(feature) not in (2, 3, 4):
            raise ValueError("each feature must be (path, OBJECTID[, transform[, state_word]])")
        p, source_object_id = feature[0], feature[1]
        source_to_merged = IDENTITY if len(feature) == 2 else feature[2]
        state_word = validate_state_word(feature[3]) if len(feature) == 4 else DEFAULT_STATE_WORD
        if isinstance(source_object_id, bool) or not isinstance(source_object_id, int) or source_object_id < 0 or source_object_id > 0xFFFFFFFF:
            raise ValueError(f"invalid UINT32 source OBJECTID: {source_object_id!r}")
        if not isinstance(p, Path):
            p = Path(p)
        if (not isinstance(source_to_merged, list) or len(source_to_merged) != 16 or
            not all(isinstance(value, (int, float)) and math.isfinite(float(value)) for value in source_to_merged)):
            raise ValueError(f"invalid tile transform for {p}")
        object_ids.append(source_object_id)
        state_words.append(state_word)
        doc, bindata = read_glb(p)
        nodes = doc.get("nodes", [])
        mesh_nodes = [node for node in nodes if isinstance(node, dict) and "mesh" in node]
        if len(mesh_nodes) != 1:
            raise ValueError(f"expected one mesh node in {p}, found {len(mesh_nodes)}")
        node_matrix = mesh_nodes[0].get("matrix", IDENTITY)
        if len(node_matrix) != 16 or not all(math.isfinite(float(v)) for v in node_matrix):
            raise ValueError(f"invalid glTF node matrix in {p}")
        content_transform = matmul(source_to_merged, [float(v) for v in node_matrix])
        for prim in doc["meshes"][mesh_nodes[0]["mesh"]]["primitives"]:
            pa = doc["accessors"][prim["attributes"]["POSITION"]]
            na = doc["accessors"][prim["attributes"]["NORMAL"]]
            pv = doc["bufferViews"][pa["bufferView"]]
            nv = doc["bufferViews"][na["bufferView"]]
            po = int(pv.get("byteOffset", 0)) + int(pa.get("byteOffset", 0))
            no = int(nv.get("byteOffset", 0)) + int(na.get("byteOffset", 0))
            count = pa["count"]
            pb_raw = bindata[po:po + count * 12]
            nb_raw = bindata[no:no + count * 12]
            if len(pb_raw) != count * 12 or len(nb_raw) != count * 12:
                raise ValueError(f"truncated position/normal buffer in {p}")
            positions = [transform_point(content_transform, struct.unpack_from("<3f", pb_raw, i * 12)) for i in range(count)]
            normals = [transform_normal(content_transform, struct.unpack_from("<3f", nb_raw, i * 12)) for i in range(count)]
            pb = b"".join(struct.pack("<3f", *point) for point in positions)
            nb = b"".join(struct.pack("<3f", *normal) for normal in normals)
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
            # Per-vertex local feature index, linked to the property-table row.
            # glTF vertex attributes cannot use UNSIGNED_INT. Local row
            # indices are exactly representable in FLOAT through 2**24.
            if feature_index > 2**24:
                raise ValueError("feature index exceeds exact FLOAT integer range")
            fid_bytes = struct.pack("<f", feature_index) * count
            fid_offset = len(binary)
            binary.extend(fid_bytes)
            fid_view = len(views)
            views.append({"buffer": 0, "byteOffset": fid_offset, "byteLength": len(fid_bytes), "target": 34962})
            fid_accessor = len(acc)
            acc.append({"bufferView": fid_view, "componentType": 5126, "count": count, "type": "SCALAR"})
            mi = len(mats)
            mats.append({"pbrMetallicRoughness": {"baseColorFactor": color,
                                                  "metallicFactor": 0.0, "roughnessFactor": 0.9}})
            prims.append({
                "attributes": {"POSITION": ai, "NORMAL": ni, "_FEATURE_ID_0": fid_accessor},
                "extensions": {"EXT_mesh_features": {"featureIds": [{
                    "featureCount": len(features), "attribute": 0, "propertyTable": 0
                }]}},
                "mode": 4, "material": mi
            })
    while len(binary) % 4:
        binary.append(0)
    while len(binary) % 2:
        binary.append(0)
    state_word_offset = len(binary)
    state_word_bytes = b"".join(struct.pack("<H", state_word) for state_word in state_words)
    binary.extend(state_word_bytes)
    state_word_view = len(views)
    views.append({"buffer": 0, "byteOffset": state_word_offset, "byteLength": len(state_word_bytes)})

    while len(binary) % 4:
        binary.append(0)
    object_id_offset = len(binary)
    object_id_bytes = b"".join(struct.pack("<I", sid) for sid in object_ids)
    binary.extend(object_id_bytes)
    object_id_view = len(views)
    views.append({"buffer": 0, "byteOffset": object_id_offset, "byteLength": len(object_id_bytes)})
    while len(binary) % 4:
        binary.append(0)
    doc = {"asset": {"version": "2.0", "generator": "TSM implicit tiling merger v2"},
           "extensionsUsed": ["EXT_mesh_features", "EXT_structural_metadata"],
           "extensions": {"EXT_structural_metadata": {
               "schema": {
                   "id": "tsm_building_feature_schema",
                   "classes": {"building": {"properties": {
                       "OBJECTID": {"type": "SCALAR", "componentType": "UINT32"},
                       "StateWord": {"type": "SCALAR", "componentType": "UINT16"}
                   }}}
               },
               "propertyTables": [{"class": "building", "count": len(object_ids),
                                   "properties": {
                                       "OBJECTID": {"values": object_id_view},
                                       "StateWord": {"values": state_word_view}
                                   }}]
           }},
           "extras": {"tsm": {
               "stateWordSchema": STATE_WORD_SCHEMA,
               "stateWordDefault": "presentation-baseline",
               "stateWordHasAuthoritativeMeaning": False
           }},
           "scene": 0, "scenes": [{"nodes": [0]}],
           "nodes": [{"mesh": 0}],
           "meshes": [{"primitives": prims}], "materials": mats,
           "buffers": [{"byteLength": len(binary)}],
           "bufferViews": views, "accessors": acc}
    j = json.dumps(doc, separators=(",", ":")).encode()
    j += b" " * ((4 - len(j) % 4) % 4)
    return (struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(j) + 8 + len(binary)) +
            struct.pack("<I4s", len(j), b"JSON") + j +
            struct.pack("<I4s", len(binary), b"BIN\x00") + binary)


class BuildingContent(NamedTuple):
    path: Path
    object_id: int
    bounds: tuple[float, float, float, float, float, float]
    gltf_transform: list[float]
    state_word: int


class QuadNode:
    def __init__(self, level, x, y, bounds):
        self.level, self.x, self.y = level, x, y
        self.bounds = bounds  # (min_x, min_y, max_x, max_y) in root-local coordinates
        self.items: list[BuildingContent] = []
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
        candidates = [QuadNode(self.level + 1, cx, cy, bounds) for cx, cy, bounds in quads]
        retained = []
        for item in self.items:
            x0, y0, _, x1, y1, _ = item.bounds
            child = next((node for node in candidates
                          if node.bounds[0] <= x0 <= x1 <= node.bounds[2]
                          and node.bounds[1] <= y0 <= y1 <= node.bounds[3]), None)
            if child is None:
                retained.append(item)
            else:
                child.items.append(item)
        self.items = retained
        self.children = [child for child in candidates if child.items]
        for child in self.children:
            child.subdivide(max_depth, max_items)

    def all_nodes(self):
        yield self
        for c in self.children:
            yield from c.all_nodes()


def tile_id(level, x, y):
    return f"{level}-{x}-{y}"


def _morton_code(x: int, y: int) -> int:
    """Return a 2D Morton/Z-order index for non-negative tile coordinates."""
    code = 0
    bit = 0
    while (1 << bit) <= max(x, y):
        code |= ((x >> bit) & 1) << (2 * bit)
        code |= ((y >> bit) & 1) << (2 * bit + 1)
        bit += 1
    return code


def write_subtree(
    path: Path,
    nodes: dict,
    subtree_roots: set[tuple[int, int, int]],
    subtree_level: int,
    subtree_x: int,
    subtree_y: int,
):
    """Write a JSON-encoded 3D Tiles subtree with Morton-ordered bitstreams."""
    tile_bits: list[int] = []
    content_bits: list[int] = []
    for depth in range(SUBTREE_LEVELS):
        scale = 2 ** depth
        local_tiles = [(lx, ly) for ly in range(scale) for lx in range(scale)]
        local_tiles.sort(key=lambda point: _morton_code(point[0], point[1]))
        for lx, ly in local_tiles:
            tx, ty = subtree_x * scale + lx, subtree_y * scale + ly
            info = nodes.get((subtree_level + depth, tx, ty))
            tile_bits.append(1 if info else 0)
            content_bits.append(1 if info and info.get("has_content") else 0)

    child_bits: list[int] = []
    child_scale = 2 ** SUBTREE_LEVELS
    local_children = [(lx, ly) for ly in range(child_scale) for lx in range(child_scale)]
    local_children.sort(key=lambda point: _morton_code(point[0], point[1]))
    for lx, ly in local_children:
        child_key = (
            subtree_level + SUBTREE_LEVELS,
            subtree_x * child_scale + lx,
            subtree_y * child_scale + ly,
        )
        child_bits.append(1 if child_key in subtree_roots else 0)

    def to_bitstream(bits: list[int]) -> bytes:
        data = bytearray((len(bits) + 7) // 8)
        for index, bit in enumerate(bits):
            if bit:
                data[index // 8] |= 1 << (index % 8)
        return bytes(data)

    binary = bytearray()
    views = []
    for bits in (tile_bits, content_bits, child_bits):
        payload = to_bitstream(bits)
        # 3D Tiles 1.1 requires 8-byte-aligned offsets. The view excludes padding.
        binary.extend(b"\0" * (-len(binary) % 8))
        views.append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(payload)})
        binary.extend(payload)
    subtree = {
        "buffers": [{"uri": path.with_suffix(".bin").name, "byteLength": len(binary)}],
        "bufferViews": views,
        "tileAvailability": {"bitstream": 0},
        "contentAvailability": [{"bitstream": 1}],
        "childSubtreeAvailability": {"bitstream": 2},
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.with_suffix(".bin").write_bytes(binary)
    path.write_text(json.dumps(subtree, indent=2) + "\n", encoding="utf-8")
    return tile_bits, content_bits, child_bits


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--input", required=True, type=Path, help="flat tileset.json")
    ap.add_argument("--tiles-dir", required=True, type=Path, help="dir with per-building GLBs")
    ap.add_argument("--output", required=True, type=Path, help="output tileset.json")
    ap.add_argument("--max-depth", type=int, default=6)
    ap.add_argument("--max-items", type=int, default=50)
    ap.add_argument("--geometric-error", type=float, default=1000.0)
    args = ap.parse_args()
    if args.max_depth < 0 or args.max_items < 1:
        ap.error("max-depth must be nonnegative and max-items must be positive")
    if not math.isfinite(args.geometric_error) or args.geometric_error < 0:
        ap.error("geometric-error must be finite and nonnegative")

    ts = json.loads(args.input.read_text())
    children = ts.get("root", {}).get("children", [])
    if not children:
        raise SystemExit("flat tileset has no children")

    # Keep the HLOD root transform and flatten descendants into that frame.
    root_node = ts["root"]
    root_transform = root_node.get("transform", IDENTITY)
    items: list[BuildingContent] = []
    source_ids: set[int] = set()

    def visit(node: dict, local: list[float]):
        content = node.get("content", {})
        uri = content.get("uri")
        metadata = node.get("extras", {}).get("tsm", {})
        sid = metadata.get("sourceObjectId")
        if uri and isinstance(sid, int) and not isinstance(sid, bool):
            if sid in source_ids:
                raise SystemExit(f"duplicate source OBJECTID: {sid}")
            glb_path = args.tiles_dir / uri
            if not glb_path.is_file():
                raise SystemExit(f"missing source GLB: {glb_path}")
            box = node.get("boundingVolume", {}).get("box")
            if (not isinstance(box, list) or len(box) != 12
                    or not all(isinstance(value, (int, float)) and math.isfinite(value) for value in box)):
                raise SystemExit(f"source OBJECTID {sid} requires a finite boundingVolume.box")
            bounds = aabb([transform_point(local, corner) for corner in box_corners(box)])
            # Leave enough room for the merged float32 POSITION values at this magnitude.
            bounds = tuple(v + (-1 if i < 3 else 1) * max(0.001, abs(v) * 2**-23)
                           for i, v in enumerate(bounds))
            word = metadata.get("stateWord")
            try:
                state_word = DEFAULT_STATE_WORD if word is None else validate_state_word(word)
            except ValueError as exc:
                raise SystemExit(f"invalid StateWord on source object {sid}: {exc}") from exc
            gltf_transform = matmul(TILE_TO_GLTF, matmul(local, GLTF_TO_TILE))
            items.append(BuildingContent(glb_path, sid, bounds, gltf_transform, state_word))
            source_ids.add(sid)
        for child in node.get("children", []):
            transform = child.get("transform", IDENTITY)
            if (not isinstance(transform, list) or len(transform) != 16
                    or not all(isinstance(value, (int, float)) and math.isfinite(value) for value in transform)):
                raise SystemExit("invalid descendant tile transform")
            visit(child, matmul(local, transform))

    if (not isinstance(root_transform, list) or len(root_transform) != 16
            or not all(isinstance(value, (int, float)) and math.isfinite(value) for value in root_transform)):
        raise SystemExit("invalid root transform")
    visit(root_node, IDENTITY)
    if not items:
        raise SystemExit("no source building tiles with content and sourceObjectId were found")

    lo = [min(item.bounds[i] for item in items) for i in range(3)]
    hi = [max(item.bounds[i + 3] for item in items) for i in range(3)]
    center = [(a + b) / 2 for a, b in zip(lo, hi)]
    half = [(b - a) / 2 for a, b in zip(lo, hi)]
    root = QuadNode(0, 0, 0, (lo[0], lo[1], hi[0], hi[1]))
    root.items = items
    root.subdivide(args.max_depth, args.max_items)

    out_dir = args.output.parent
    content_dir = out_dir / "content"
    subtree_dir = out_dir / "subtrees"

    nodes = {}
    leaf_count = 0
    for node in root.all_nodes():
        lvl, x, y = node.level, node.x, node.y
        nodes[(lvl, x, y)] = {"has_content": bool(node.items)}
        leaf_count += not node.children
        if not node.items:
            continue
        glb_path = content_dir / str(lvl) / str(x) / f"{y}.glb"
        glb_path.parent.mkdir(parents=True, exist_ok=True)
        merged = merge_glbs([
            (item.path, item.object_id, item.gltf_transform, item.state_word)
            for item in node.items
        ])
        glb_path.write_bytes(merged)
        nodes[(lvl, x, y)]["sids"] = [item.object_id for item in node.items]

    # Write subtree files (grouped by SUBTREE_LEVELS)
    subtree_roots = set()
    for (lvl, x, y) in nodes:
        sl = (lvl // SUBTREE_LEVELS) * SUBTREE_LEVELS
        # Quadtree coordinates double at each level (not quadruple).
        factor = 2 ** (lvl - sl)
        subtree_roots.add((sl, x // factor, y // factor))

    for sl, sx, sy in sorted(subtree_roots):
        spath = subtree_dir / str(sl) / str(sx) / f"{sy}.subtree"
        write_subtree(spath, nodes, subtree_roots, sl, sx, sy)

    # Root tileset.json with implicitTiling (NO legacy extension)
    tileset = {
        "asset": {
            "version": "1.1",
            "tilesetVersion": "1.0.0",
            # NOTE: no "3DTILES_implicit_tiling" in extensionsUsed;
            # implicit tiling is core in 3D Tiles 1.1.
            "extras": {"tsm": {
                "authorityClass": "DERIVED",
                "engineeringUse": False,
                "regulatoryUse": False,
                "implicitTiling": "QUADTREE",
                "subtreeLevels": SUBTREE_LEVELS,
            }},
        },
        "geometricError": args.geometric_error,
        "root": {
            "transform": root_transform,
            "boundingVolume": {
                "box": [*center, half[0], 0, 0, 0, half[1], 0, 0, 0, half[2]],
            },
            "geometricError": args.geometric_error,
            "refine": "ADD",
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
