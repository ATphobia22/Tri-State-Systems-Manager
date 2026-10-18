from __future__ import annotations

import importlib.util
import json
import struct
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("build-implicit-tileset.py")
SPEC = importlib.util.spec_from_file_location("build_implicit_tileset", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def make_fixture_glb(path: Path) -> None:
    positions = [(0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)]
    normals = [(0.0, 0.0, 1.0)] * 3
    position_bytes = b"".join(struct.pack("<3f", *v) for v in positions)
    normal_bytes = b"".join(struct.pack("<3f", *v) for v in normals)
    binary = position_bytes + normal_bytes
    document = {
        "asset": {"version": "2.0"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "mode": 4, "material": 0}]}],
        "materials": [{"pbrMetallicRoughness": {"baseColorFactor": [0.5, 0.5, 0.5, 1.0]}}],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(position_bytes), "target": 34962},
            {"buffer": 0, "byteOffset": len(position_bytes), "byteLength": len(normal_bytes), "target": 34962},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3", "min": [0, 0, 0], "max": [1, 1, 0]},
            {"bufferView": 1, "componentType": 5126, "count": 3, "type": "VEC3"},
        ],
    }
    encoded = json.dumps(document, separators=(",", ":")).encode()
    encoded += b" " * ((4 - len(encoded) % 4) % 4)
    padded_binary = binary + b"\x00" * ((4 - len(binary) % 4) % 4)
    chunks = struct.pack("<I4s", len(encoded), b"JSON") + encoded
    chunks += struct.pack("<I4s", len(padded_binary), b"BIN\x00") + padded_binary
    path.write_bytes(struct.pack("<4sII", b"glTF", 2, 12 + len(chunks)) + chunks)


class ImplicitTilesetContractTests(unittest.TestCase):
    def test_morton_order_is_quadtree_order(self):
        coords = [(x, y) for y in range(2) for x in range(2)]
        coords.sort(key=lambda p: MODULE._morton_code(*p))
        self.assertEqual(coords, [(0, 0), (1, 0), (0, 1), (1, 1)])

    def test_subtree_uses_two_level_tile_indices_and_child_availability(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            nodes = {
                (0, 0, 0): {"has_content": False},
                (1, 0, 0): {"has_content": True},
                (1, 1, 0): {"has_content": False},
                (1, 0, 1): {"has_content": True},
                (1, 1, 1): {"has_content": False},
            }
            child_roots = {(2, 0, 0), (2, 1, 0)}
            subtree_path = root / "subtrees" / "0" / "0" / "0.subtree"
            MODULE.write_subtree(subtree_path, nodes, child_roots, 0, 0, 0)
            subtree = json.loads(subtree_path.read_text())
            self.assertEqual(subtree["tileAvailability"], {"bitstream": 0})
            self.assertEqual(subtree["contentAvailability"], [{"bitstream": 1}])
            self.assertEqual(subtree["childSubtreeAvailability"], {"bitstream": 2})
            raw = (subtree_path.parent / "0.bin").read_bytes()
            self.assertEqual(len(raw), 4)  # 1 byte tile + 1 byte content + 2 bytes child subtrees
            self.assertEqual(raw[2], 0b00000011)

    def test_quadnode_subdivides_five_field_transformed_items(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            node = MODULE.QuadNode(0, 0, 0, (0.0, 0.0, 1.0, 1.0))
            identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
            node.items = [(root / "feature.glb", 0.5, 0.5, 101, identity)]
            node.subdivide(max_depth=2, max_items=0)
            self.assertTrue(node.children)
            self.assertEqual(sum(len(leaf.items) for leaf in node.leaves()), 1)

    def test_merged_glb_keeps_objectid_property_table_and_feature_ids(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            first, second = root / "a.glb", root / "b.glb"
            make_fixture_glb(first)
            make_fixture_glb(second)
            identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
            merged = MODULE.merge_glbs([(first, 101, identity), (second, 202, identity)])
            path = root / "merged.glb"
            path.write_bytes(merged)
            document, binary = MODULE.read_glb(path)
            self.assertEqual(set(document["extensionsUsed"]), {"EXT_mesh_features", "EXT_structural_metadata"})
            table = document["extensions"]["EXT_structural_metadata"]["propertyTables"][0]
            self.assertEqual(table["count"], 2)
            view = document["bufferViews"][table["properties"]["OBJECTID"]["values"]]
            offset = view.get("byteOffset", 0)
            self.assertEqual(struct.unpack_from("<II", binary, offset), (101, 202))
            for primitive in document["meshes"][0]["primitives"]:
                self.assertIn("_FEATURE_ID_0", primitive["attributes"])
                self.assertIn("EXT_mesh_features", primitive["extensions"])


if __name__ == "__main__":
    unittest.main()
