#!/usr/bin/env python3
"""Regression tests for the structural GLB preflight; synthetic assets only."""
import json
import struct
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("validate-building-tiles.sh")


class StructuralPreflightTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "tileset.json").write_text(
            json.dumps({"asset": {"version": "1.1", "extras": {"tsm": {"authorityClass": "DERIVED"}}}}),
            encoding="utf-8",
        )

    def run_preflight(self):
        return subprocess.run(["bash", str(SCRIPT), str(self.root)],
                              capture_output=True, text=True, check=False)

    def add_glb(self, name="nested/tile.glb", version=2, declared=None):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        size = 12 if declared is None else declared
        path.write_bytes(b"glTF" + struct.pack("<II", version, size))
        return path

    def test_valid_nested_glb_preflight_passes_without_claiming_acceptance(self):
        self.add_glb()
        result = self.run_preflight()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Structural preflight only", result.stdout)
        self.assertIn("1 GLB", result.stdout)

    def test_no_glbs_is_not_a_success(self):
        result = self.run_preflight()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("no GLB", result.stderr)

    def test_wrong_declared_glb_length_rejected(self):
        self.add_glb(declared=900)
        result = self.run_preflight()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("declared byte length", result.stderr)

    def test_invalid_glb_version_rejected(self):
        self.add_glb(version=1)
        result = self.run_preflight()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("invalid GLB version", result.stderr)

    def test_derived_geometry_cannot_claim_regulatory_authority(self):
        (self.root / "tileset.json").write_text(
            json.dumps({"asset": {"version": "1.1", "extras": {"tsm": {"regulatoryUse": True}}}}),
            encoding="utf-8",
        )
        self.add_glb()
        result = self.run_preflight()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("regulatory authority", result.stderr)


if __name__ == "__main__":
    unittest.main()
