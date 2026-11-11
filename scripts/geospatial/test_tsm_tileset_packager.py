#!/usr/bin/env python3
"""Synthetic regression tests for strict offline 3D Tiles stager."""
import hashlib
import json
from pathlib import Path
import struct
import tempfile
import unittest

from scripts.geospatial.tsm_tileset_packager import stage, walk_tileset


def glb_bytes():
    doc = {"asset": {"version": "2.0"}, "meshes": [{"primitives": [{"attributes": {}}]}],
           "buffers": [{"byteLength": 0}]}
    raw = json.dumps(doc).encode()
    raw += b" " * ((4 - len(raw) % 4) % 4)
    return b"glTF" + struct.pack("<II", 2, 20 + len(raw)) + struct.pack("<I", len(raw)) + b"JSON" + raw


def tileset(uri="tile.glb"):
    return {
        "asset": {"version": "1.1"},
        "geometricError": 10,
        "root": {
            "boundingVolume": {"box": [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]},
            "geometricError": 5,
            "transform": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,
                          -1900000, 5000000, 3000000, 1],
            "refine": "ADD",
            "children": [{
                "boundingVolume": {"box": [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]},
                "geometricError": 0,
                "content": {"uri": uri}
            }]
        }
    }


class OfflineTilesetStageTests(unittest.TestCase):
    def test_stages_local_bytes_and_receipts(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "tile.glb").write_bytes(glb_bytes())
            (root / "tileset.json").write_text(json.dumps(tileset()))
            count = stage(root / "tileset.json", root / "output")
            self.assertEqual(count, 1)
            staged = root / "output"
            self.assertEqual((staged / "tile.glb").read_bytes(), glb_bytes())
            manifest = json.loads((staged / "offline-asset-manifest.json").read_text())
            self.assertEqual(manifest["assetCount"], 1)
            self.assertFalse(manifest["geospatialPlacementIndependentlyVerified"])
            self.assertFalse(manifest["windowsShippingRuntimeVerified"])
            self.assertEqual(manifest["files"][1]["sha256"], hashlib.sha256(glb_bytes()).hexdigest())
            with self.assertRaisesRegex(ValueError, "must not exist"):
                stage(root / "tileset.json", staged)

    def test_rejects_missing_georeferencing(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "tile.glb").write_bytes(glb_bytes())
            t = tileset()
            del t["root"]["transform"]
            (root / "tileset.json").write_text(json.dumps(t))
            with self.assertRaisesRegex(ValueError, "georeferencing"):
                stage(root / "tileset.json", root / "out")

    def test_rejects_unsafe_paths_and_bad_bounding_volumes(self):
        for uri in ("../tile.glb", "https://bad.example/tile.glb", r"..\tile.glb",
                    "/tile.glb", "C:/tile.glb"):
            with self.subTest(uri=uri), self.assertRaises(ValueError):
                walk_tileset(tileset(uri))
        t = tileset()
        t["root"]["boundingVolume"]["box"][3] = 0
        with self.assertRaises(ValueError):
            walk_tileset(t)

    def test_rejects_corrupted_glb(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "tile.glb").write_bytes(b"not a GLB")
            (root / "tileset.json").write_text(json.dumps(tileset()))
            with self.assertRaisesRegex(ValueError, "Invalid GLB"):
                stage(root / "tileset.json", root / "out")


if __name__ == "__main__":
    unittest.main()
