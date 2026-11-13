"""Synthetic tests for optional Blender visual asset provenance receipts."""
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts/geospatial/validate_visual_asset_receipt.py"
spec = importlib.util.spec_from_file_location("validate_visual_asset_receipt", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ReceiptTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "scene.glb").write_bytes(b"synthetic fixture")
        self.data = dict(schema="tsm.visual-asset-receipt.v1", asset="scene.glb",
                         sha256=hashlib.sha256(b"synthetic fixture").hexdigest(),
                         source_uri="https://example.org/source", license="MIT",
                         horizontal_frame="NAD83(2011)", vertical_datum="NAVD88",
                         coordinate_epoch=None, units="m", authority_class="DERIVED",
                         transformation_status="NOT_APPLIED", visualization_only=True)
        self.path = self.root / "receipt.json"

    def check(self):
        self.path.write_text(json.dumps(self.data), encoding="utf-8")
        return module.validate(self.path, self.root)

    def test_valid(self):
        self.assertEqual(self.check()["status"], "VISUALIZATION_RECEIPT_VERIFIED")

    def test_bad_hash(self):
        self.data["sha256"] = "0" * 64
        with self.assertRaises(module.ReceiptError): self.check()

    def test_path_escape(self):
        self.data["asset"] = "../scene.glb"
        with self.assertRaises(module.ReceiptError): self.check()

    def test_beta_never_operational(self):
        self.data["authority_class"] = "EXPERIMENTAL_BETA"
        self.assertTrue(self.check()["beta_operational_use_prohibited"])

    def test_visualization_only(self):
        self.data["visualization_only"] = False
        with self.assertRaises(module.ReceiptError): self.check()

    def test_missing_epoch(self):
        del self.data["coordinate_epoch"]
        with self.assertRaises(module.ReceiptError): self.check()

if __name__ == "__main__":
    unittest.main()
