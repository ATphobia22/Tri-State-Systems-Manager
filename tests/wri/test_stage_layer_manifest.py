import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

BASE = Path(__file__).resolve().parents[2] / "scripts" / "wri"
sys.path.insert(0, str(BASE))
spec = importlib.util.spec_from_file_location("wri_stage", BASE / "stage_layer_manifest.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
REG = {"datasets": [{
    "id": "wri.aqueduct40.basins",
    "title": "Aqueduct Global Maps 4.0",
    "page": "https://datasets.wri.org/datasets/aqueduct-global-maps-40-data",
    "renderLayer": "wri.water-risk",
    "license": "CC-BY-4.0",
}]}


class WRIManifestTests(unittest.TestCase):
    def setup_asset(self, directory):
        asset = Path(directory) / "water-risk.zip"
        asset.write_bytes(b"test-only")
        receipt = {"source_id": "wri.aqueduct40.basins", "status": "ACQUIRED_UNREVIEWED",
                   "authority": "World Resources Institute",
                   "source_url": "https://files.wri.org/data/water-risk.zip",
                   "bytes": 9, "sha256": hashlib.sha256(b"test-only").hexdigest(),
                   "local_path": asset.name}
        return asset, receipt

    def test_staged_source_is_inactive_and_nonregulatory(self):
        with tempfile.TemporaryDirectory() as temp:
            asset, receipt = self.setup_asset(temp)
            result = m.prepare_manifest(registry=REG, receipt=receipt, asset=asset)
            self.assertEqual(result["asset_sha256"], receipt["sha256"])
            self.assertFalse(result["enabled"])
            self.assertFalse(result["render_ready"])
            self.assertFalse(result["regulatory_use"])
            self.assertEqual(result["coverage"], "UNVERIFIED_FOR_AOI")

    def test_tampering_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            asset, receipt = self.setup_asset(temp)
            asset.write_bytes(b"forged!!?")
            with self.assertRaises(ValueError):
                m.prepare_manifest(registry=REG, receipt=receipt, asset=asset)

    def test_unknown_id_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            asset, receipt = self.setup_asset(temp)
            receipt["source_id"] = "unapproved"
            with self.assertRaises(ValueError):
                m.prepare_manifest(registry=REG, receipt=receipt, asset=asset)

    def test_external_source_url_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            asset, receipt = self.setup_asset(temp)
            receipt["source_url"] = "https://notwri.example/file"
            with self.assertRaises(ValueError):
                m.prepare_manifest(registry=REG, receipt=receipt, asset=asset)

    def test_missing_asset_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            asset, receipt = self.setup_asset(temp)
            asset.unlink()
            with self.assertRaises(ValueError):
                m.prepare_manifest(registry=REG, receipt=receipt, asset=asset)


if __name__ == "__main__":
    unittest.main()
