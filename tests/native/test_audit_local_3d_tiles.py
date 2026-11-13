import importlib.util
import json
import struct
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts/native/audit_local_3d_tiles.py"
spec = importlib.util.spec_from_file_location("tiles_audit", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class LocalTilesAuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / "TSMData"
        (self.root / "tiles").mkdir(parents=True)
        (self.root / "tiles/one.glb").write_bytes(self.glb({}))
        self.index = self.root / "tileset.json"
        self.write("tiles/one.glb")

    @staticmethod
    def glb(document):
        payload = json.dumps(document).encode("utf-8")
        payload += b" " * ((-len(payload)) % 4)
        return struct.pack("<4sII", b"glTF", 2, 20 + len(payload)) + struct.pack("<I4s", len(payload), b"JSON") + payload

    def test_external_glb_dependency(self):
        (self.root / "tiles/texture.png").write_bytes(b"texture fixture")
        (self.root / "tiles/one.glb").write_bytes(self.glb({"images": [{"uri": "texture.png"}]}))
        out = module.audit(self.root, self.index)
        self.assertEqual(out["payloads"], 2)
        (self.root / "tiles/texture.png").unlink()
        with self.assertRaisesRegex(ValueError, "missing"):
            module.audit(self.root, self.index)

    def implicit_fixture(self, malformed=False):
        def binary_subtree(document, payload=b""):
            raw = json.dumps(document).encode("utf-8")
            raw += b" " * ((-len(raw)) % 8)
            payload += b"\x00" * ((-len(payload)) % 8)
            return struct.pack("<4sIQQ", b"subt", 1, len(raw), len(payload)) + raw + payload

        self.index.write_text(json.dumps({
            "asset": {"version": "1.1"},
            "root": {
                "implicitTiling": {
                    "subdivisionScheme": "QUADTREE", "subtreeLevels": 1,
                    "availableLevels": 2,
                    "subtrees": {"uri": "subtrees/{level}/{x}/{y}.subtree"},
                },
                "content": {"uri": "content/{level}/{x}/{y}.glb"},
            },
        }))
        (self.root / "content/0/0").mkdir(parents=True)
        (self.root / "content/1/0").mkdir(parents=True)
        (self.root / "content/0/0/0.glb").write_bytes(self.glb({"asset": {"version": "2.0"}}))
        (self.root / "content/1/0/0.glb").write_bytes(self.glb({"asset": {"version": "2.0"}}))
        (self.root / "subtrees/0/0").mkdir(parents=True)
        (self.root / "subtrees/1/0").mkdir(parents=True)
        first = {
            "buffers": [{"byteLength": 1}],
            "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": 1}],
            "tileAvailability": {"constant": 1},
            "contentAvailability": [{"constant": 1}],
            "childSubtreeAvailability": {"bitstream": 0, "availableCount": 1},
        }
        if malformed:
            first["childSubtreeAvailability"]["availableCount"] = 2
        (self.root / "subtrees/0/0/0.subtree").write_bytes(binary_subtree(first, b"\x01"))
        (self.root / "subtrees/1/0/0.subtree").write_text(json.dumps({
            "tileAvailability": {"constant": 1},
            "contentAvailability": [{"constant": 1}],
            "childSubtreeAvailability": {"constant": 0},
        }))

    def test_binary_implicit_subtrees_are_audited_to_referenced_content(self):
        self.implicit_fixture()
        result = module.audit(self.root, self.index)
        self.assertEqual(result["implicitSubtrees"], 2)
        self.assertEqual(result["implicitAvailableTiles"], 2)
        self.assertEqual(result["implicitContents"], 2)
        self.assertEqual(result["payloads"], 4)
        self.assertFalse(result["releaseCertified"])
        self.assertFalse(result["offlineRuntimeVerified"])

    def test_implicit_missing_content_fails(self):
        self.implicit_fixture()
        (self.root / "content/1/0/0.glb").unlink()
        with self.assertRaisesRegex(ValueError, "missing"):
            module.audit(self.root, self.index)

    def test_implicit_missing_child_subtree_fails(self):
        self.implicit_fixture()
        (self.root / "subtrees/1/0/0.subtree").unlink()
        with self.assertRaisesRegex(ValueError, "missing"):
            module.audit(self.root, self.index)

    def test_implicit_mismatched_available_count_fails(self):
        self.implicit_fixture(malformed=True)
        with self.assertRaisesRegex(ValueError, "availableCount"):
            module.audit(self.root, self.index)

    def test_implicit_truncated_binary_header_fails(self):
        self.implicit_fixture()
        (self.root / "subtrees/0/0/0.subtree").write_bytes(b"subt")
        with self.assertRaisesRegex(ValueError, "header"):
            module.audit(self.root, self.index)

    def test_implicit_rejects_unsafe_python_format_expansion(self):
        self.implicit_fixture()
        spec = json.loads(self.index.read_text())
        spec["root"]["content"]["uri"] = "content/{level}/{x:>999999999}/{y}.glb"
        self.index.write_text(json.dumps(spec))
        with self.assertRaisesRegex(ValueError, "template"):
            module.audit(self.root, self.index)

    def test_implicit_rejects_missing_coordinate_in_template(self):
        self.implicit_fixture()
        spec = json.loads(self.index.read_text())
        spec["root"]["implicitTiling"]["subtrees"]["uri"] = "subtrees/{level}/{x}.subtree"
        self.index.write_text(json.dumps(spec))
        with self.assertRaisesRegex(ValueError, "template"):
            module.audit(self.root, self.index)

    def test_implicit_rejects_explicit_children(self):
        self.implicit_fixture()
        spec = json.loads(self.index.read_text())
        spec["root"]["children"] = []
        self.index.write_text(json.dumps(spec))
        with self.assertRaisesRegex(ValueError, "children"):
            module.audit(self.root, self.index)

    def test_implicit_rejects_external_tileset_content(self):
        self.implicit_fixture()
        spec = json.loads(self.index.read_text())
        spec["root"]["content"]["uri"] = "content/{level}/{x}/{y}.json"
        self.index.write_text(json.dumps(spec))
        (self.root / "content/0/0/0.json").write_text('{"root":{}}')
        with self.assertRaisesRegex(ValueError, "external tileset"):
            module.audit(self.root, self.index)

    def test_implicit_rejects_second_internal_buffer(self):
        self.implicit_fixture()
        subtree = self.root / "subtrees/1/0/0.subtree"
        subtree.write_text(json.dumps({
            "buffers": [{"byteLength": 0}, {"byteLength": 0}],
            "tileAvailability": {"constant": 1},
            "contentAvailability": [{"constant": 1}],
            "childSubtreeAvailability": {"constant": 0}
        }))
        with self.assertRaisesRegex(ValueError, "internal"):
            module.audit(self.root, self.index)

    def test_implicit_uri_traversal_fails(self):
        self.implicit_fixture()
        spec = json.loads(self.index.read_text())
        spec["root"]["content"]["uri"] = "../content/{level}/{x}/{y}.glb"
        self.index.write_text(json.dumps(spec))
        with self.assertRaisesRegex(ValueError, "traversal"):
            module.audit(self.root, self.index)

    def test_implicit_budget_failure_keeps_gate_closed(self):
        self.implicit_fixture()
        spec = json.loads(self.index.read_text())
        spec["root"]["implicitTiling"]["subtreeLevels"] = 12
        self.index.write_text(json.dumps(spec))
        with self.assertRaisesRegex(ValueError, "subtreeLevels"):
            module.audit(self.root, self.index)

    def test_octree_morton_coordinates_and_external_buffers(self):
        # OCTREE Morton child (x=1,y=0,z=1) has index 5. With the
        # root at index 0, the child availability bit is index 6.
        self.index.write_text(json.dumps({"asset": {"version": "1.1"}, "root": {
            "implicitTiling": {"subdivisionScheme": "OCTREE",
                               "subtreeLevels": 2, "availableLevels": 2,
                               "subtrees": {"uri": "subtrees/{level}/{x}/{y}/{z}.json"}},
            "content": {"uri": "content/{level}/{x}/{y}/{z}.glb"}}}))
        subtree_path = self.root / "subtrees/0/0/0/0.json"
        subtree_path.parent.mkdir(parents=True)
        subtree_path.write_text(json.dumps({
            "buffers": [{"uri": "bits.bin", "byteLength": 16}],
            "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": 2},
                            {"buffer": 0, "byteOffset": 8, "byteLength": 2}],
            "tileAvailability": {"bitstream": 0, "availableCount": 2},
            "contentAvailability": [{"bitstream": 1, "availableCount": 2}],
            "childSubtreeAvailability": {"constant": 0}
        }))
        (subtree_path.parent / "bits.bin").write_bytes(
            bytes([0x41, 0x00]) + bytes(6) + bytes([0x41, 0x00]) + bytes(6))
        for level, x, y, z in ((0, 0, 0, 0), (1, 1, 0, 1)):
            target = self.root / f"content/{level}/{x}/{y}/{z}.glb"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(self.glb({"asset": {"version": "2.0"}}))
        result = module.audit(self.root, self.index)
        self.assertEqual(result["implicitSubtrees"], 1)
        self.assertEqual(result["implicitAvailableTiles"], 2)
        self.assertEqual(result["implicitContents"], 2)
        self.assertEqual(result["payloads"], 4)
        (self.root / "content/1/1/0/1.glb").unlink()
        with self.assertRaisesRegex(ValueError, "missing"):
            module.audit(self.root, self.index)

    def test_unsupported_explicit_payload_does_not_false_pass(self):
        (self.root / "tiles/one.b3dm").write_bytes(b"legacy content not parsed")
        self.write("tiles/one.b3dm")
        with self.assertRaisesRegex(ValueError, "unsupported explicit tile"):
            module.audit(self.root, self.index)

    def test_corrupt_glb_rejected(self):
        (self.root / "tiles/one.glb").write_bytes(b"glTF fixture")
        with self.assertRaisesRegex(ValueError, "invalid GLB"):
            module.audit(self.root, self.index)

    def write(self, ref):
        self.index.write_text(json.dumps({"asset": {"version": "1.1"},
            "root": {"content": {"uri": ref}}}))

    def test_local_manifest(self):
        out = module.audit(self.root, self.index)
        self.assertEqual(out["status"], "STATIC_REFERENCES_VERIFIED")
        self.assertFalse(out["releaseCertified"])
        self.assertEqual(out["payloads"], 1)
        self.assertEqual(len(out["files"]), 2)
        self.assertRegex(out["files"][0]["sha256"], r"^[a-f0-9]{64}$")

    def test_denies_network_traversal_absolute_and_fragments(self):
        for path in ("https://host/x.glb", "//host/file", "../x", "%2e%2e/x",
                     "/etc/passwd", "C:/Temp/a", "file:///a",
                     "tiles/one.glb?token=a", "tiles\\one.glb",
                     "tiles/one.glb#fragment"):
            with self.subTest(path=path):
                self.write(path)
                with self.assertRaises(ValueError):
                    module.audit(self.root, self.index)

    def test_absent_asset_rejected(self):
        self.write("tiles/unknown.glb")
        with self.assertRaisesRegex(ValueError, "missing"):
            module.audit(self.root, self.index)

    def test_nested_json_assets_checked(self):
        (self.root / "tiles/tileset.json").write_text(json.dumps({
            "asset": {"version": "1.1"},
            "root": {"contents": [{"uri": "one.glb"}]}
        }))
        self.write("tiles/tileset.json")
        out = module.audit(self.root, self.index)
        self.assertEqual(out["tilesets"], 2)
        self.assertEqual(out["payloads"], 1)

    def test_ue_map_authoring_runs_staged_content_audit(self):
        script = (SCRIPT.parent / "Generate-TSMNativeMap.ps1").read_text(encoding="utf-8")
        self.assertIn("audit_local_3d_tiles.py", script)
        self.assertIn("TSM_LOCAL_TERRAIN_TILESET", script)
        self.assertIn("TSM_LOCAL_TILESET", script)
        self.assertIn("if ($LASTEXITCODE -ne 0)", script)
        self.assertLess(script.index("audit_local_3d_tiles.py"), script.index("& $editorBuild TSMNativeEditor"))

    def test_symlink_denied(self):
        link = self.root / "tiles/link.glb"
        try:
            link.symlink_to(self.root / "tiles/one.glb")
        except (OSError, NotImplementedError):
            self.skipTest("symlinks unavailable")
        self.write("tiles/link.glb")
        with self.assertRaisesRegex(ValueError, "symlink"):
            module.audit(self.root, self.index)


if __name__ == "__main__":
    unittest.main()
