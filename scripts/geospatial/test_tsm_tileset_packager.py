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


    def test_refuses_placeholder_tileset_without_content(self):
        t = tileset()
        t["root"]["children"] = []
        with self.assertRaisesRegex(ValueError, "real local GLB"):
            walk_tileset(t)

    def test_refuses_implicit_tiling_until_subtrees_are_reviewed(self):
        t = tileset()
        t["root"]["implicitTiling"] = {"subdivisionScheme": "QUADTREE"}
        with self.assertRaisesRegex(ValueError, "Implicit"):
            walk_tileset(t)

    def test_external_resources_inside_glb_are_not_claimed_offline(self):
        doc = {"asset": {"version": "2.0"},
               "buffers": [{"byteLength": 10, "uri": "https://remote.example/buffer.bin"}]}
        raw = json.dumps(doc).encode()
        raw += b" " * ((4 - len(raw) % 4) % 4)
        glb = b"glTF" + struct.pack("<II", 2, 20 + len(raw))
        glb += struct.pack("<I", len(raw)) + b"JSON" + raw
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "tile.glb").write_bytes(glb)
            (root / "tileset.json").write_text(json.dumps(tileset()))
            with self.assertRaisesRegex(ValueError, "external resource"):
                stage(root / "tileset.json", root / "out")
            self.assertFalse((root / "out").exists())

    def test_nonexistent_and_symlinked_content_are_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "tileset.json").write_text(json.dumps(tileset()))
            with self.assertRaisesRegex(ValueError, "Missing referenced tile"):
                stage(root / "tileset.json", root / "missing")
            (root / "target.glb").write_bytes(glb_bytes())
            (root / "tile.glb").symlink_to(root / "target.glb")
            with self.assertRaisesRegex(ValueError, "symlink"):
                stage(root / "tileset.json", root / "symlink-out")

    def test_stage_does_not_claim_validation_of_ecef_or_shipping(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "tile.glb").write_bytes(glb_bytes())
            (root / "tileset.json").write_text(json.dumps(tileset()))
            stage(root / "tileset.json", root / "out")
            manifest = json.loads((root / "out" / "offline-asset-manifest.json").read_text())
            self.assertEqual(manifest["authorityClass"], "DERIVED_STAGING")
            self.assertFalse(manifest["geospatialPlacementIndependentlyVerified"])
            self.assertFalse(manifest["verticalDatumVerified"])
            self.assertFalse(manifest["sourceGeometrySurveyed"])
            self.assertFalse(manifest["windowsShippingRuntimeVerified"])
            self.assertFalse(manifest["regulatoryApproval"])


if __name__ == "__main__":
    unittest.main()
