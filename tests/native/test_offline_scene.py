"""Tests for fail-fast local scene integrity contract."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from scripts.native.validate_offline_scene import validate

class OfflineSceneTests(unittest.TestCase):
    def test_valid_and_modified(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            assets = []
            for kind in ("terrain", "buildings"):
                p = root / (kind + ".bin")
                p.write_bytes(kind.encode())
                assets.append({"kind": kind, "path": p.name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()})
            m = root / "manifest.json"
            m.write_text(json.dumps({"schema": "tsm.offline.scene.v1", "vertical_datum": "NAVD88", "horizontal_crs": "EPSG:2966", "elevation_units": "ftUS", "assets": assets}))
            self.assertEqual(validate(root, m)["status"], "PASS_HEADLESS_ASSET_INTEGRITY_ONLY")
            (root / "terrain.bin").write_bytes(b"modified")
            with self.assertRaisesRegex(ValueError, "Checksum mismatch"):
                validate(root, m)

    def test_reject_path_escape(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            m = root / "manifest.json"
            m.write_text(json.dumps({"schema": "tsm.offline.scene.v1", "vertical_datum": "NAVD88", "horizontal_crs": "EPSG:2966", "elevation_units": "ftUS", "assets": [{"kind": "terrain", "path": "../other", "sha256": "0" * 64}]}))
            with self.assertRaisesRegex(ValueError, "escaping"):
                validate(root, m)

if __name__ == "__main__":
    unittest.main()
