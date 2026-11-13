import importlib.util
import json
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
        (self.root / "tiles/one.glb").write_bytes(b"glTF fixture")
        self.index = self.root / "tileset.json"
        self.write("tiles/one.glb")

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
