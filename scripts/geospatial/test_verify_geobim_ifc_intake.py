"""Tests for the offline GeoBIM IFC integrity boundary; no external packages."""
import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("verify_geobim_ifc_intake.py")
spec = importlib.util.spec_from_file_location("verify_geobim_ifc_intake", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
IFC = b"ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n"


class GeoBimIntakeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)
        self.source = self.dir / "sample.ifc"
        self.source.write_bytes(IFC)
        self.metadata = {
            "sourceId": "fixture-001",
            "expectedSha256": hashlib.sha256(IFC).hexdigest(),
            "horizontalCrs": "EPSG:2966",
            "verticalDatum": "NAVD88",
            "units": "ftUS",
            "license": "test-fixture-only",
            "authorityClass": "CANDIDATE",
        }

    def test_good_source_reports_no_unproven_authority(self):
        result = module.verify(self.source, self.metadata)
        self.assertEqual(result["sha256"], self.metadata["expectedSha256"])
        self.assertTrue(result["sourceBytesVerified"])
        for field in ("ifcSchemaValidated", "georeferenceVerified", "surveyCertified", "regulatoryApproved", "nativeShippingVerified"):
            self.assertFalse(result[field])

    def test_checksum_mismatch(self):
        self.metadata["expectedSha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "checksum mismatch"):
            module.verify(self.source, self.metadata)

    def test_missing_vertical_datum(self):
        self.metadata["verticalDatum"] = "unknown"
        with self.assertRaisesRegex(ValueError, "vertical datum"):
            module.verify(self.source, self.metadata)

    def test_rejects_claimed_regulatory_authority(self):
        self.metadata["authorityClass"] = "AGENCY_APPROVED"
        with self.assertRaisesRegex(ValueError, "authorityClass"):
            module.verify(self.source, self.metadata)

    def test_rejects_non_ifc_file(self):
        self.source.write_bytes(b"not an IFC file")
        self.metadata["expectedSha256"] = hashlib.sha256(self.source.read_bytes()).hexdigest()
        with self.assertRaisesRegex(ValueError, "STEP"):
            module.verify(self.source, self.metadata)

    def test_cli_writes_once_without_overwriting(self):
        metadata_path = self.dir / "source.json"
        metadata_path.write_text(json.dumps(self.metadata), encoding="utf-8")
        receipt = self.dir / "receipts" / "fixture.json"
        cmd = [sys.executable, str(SCRIPT), "--ifc", str(self.source), "--metadata", str(metadata_path), "--receipt", str(receipt)]
        first = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertFalse(json.loads(receipt.read_text())["regulatoryApproved"])
        second = subprocess.run(cmd, capture_output=True, text=True)
        self.assertNotEqual(second.returncode, 0)

    def test_rejects_symlink(self):
        link = self.dir / "link.ifc"
        try:
            link.symlink_to(self.source)
        except (OSError, NotImplementedError):
            self.skipTest("symlinks unavailable")
        with self.assertRaisesRegex(ValueError, "non-symlink"):
            module.verify(link, self.metadata)


if __name__ == "__main__":
    unittest.main()
