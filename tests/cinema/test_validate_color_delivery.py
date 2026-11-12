"""Focused acceptance tests for declared ACES/OCIO asset manifest integrity."""
import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("tsm_color_gate", ROOT / "scripts/cinema/validate_color_delivery.py")
MOD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)


class ColorGateTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.manifest = {
            "schema": "tsm.cinema.color-delivery.v1",
            "workflow": "scene_linear_acescg",
            "working_space": "ACEScg",
            "science_pass_treatment": "raw_non_color_no_display_transform",
            "exr_pixel_type": "FLOAT",
            "output_display": "Rec.1886 Rec.709",
            "output_codec": "H.264",
            "ocio_config_version": "TEST_FIXTURE_CONFIG",
            "output_view": "TEST_FIXTURE_VIEW",
        }
        for kind in ("ocio_config", "render_frame_receipt", "output"):
            name = f"{kind}.fake"
            data = f"TEST FIXTURE: {kind}".encode()
            (self.root / name).write_bytes(data)
            self.manifest[f"{kind}_path"] = name
            self.manifest[f"{kind}_sha256"] = hashlib.sha256(data).hexdigest()

    def test_file_hash_preflight_only(self):
        report = MOD.validate(self.manifest, self.root)
        self.assertEqual(report["status"], "MANIFEST_AND_FILE_HASHES_CHECKED_ONLY")
        self.assertEqual(report["files_verified"], 3)

    def test_tamper_rejected(self):
        (self.root / "output.fake").write_bytes(b"changed")
        with self.assertRaisesRegex(ValueError, "mismatch"):
            MOD.validate(self.manifest, self.root)

    def test_scientific_data_must_be_raw(self):
        self.manifest["science_pass_treatment"] = "ACEScg"
        with self.assertRaisesRegex(ValueError, "bypass"):
            MOD.validate(self.manifest, self.root)

    def test_hdr10_requires_metadata_and_bit_depth(self):
        self.manifest["output_display"] = "Rec.2100-PQ"
        with self.assertRaisesRegex(ValueError, "high-bit-depth"):
            MOD.validate(self.manifest, self.root)
        self.manifest["output_codec"] = "HEVC Main10"
        with self.assertRaisesRegex(ValueError, "measured"):
            MOD.validate(self.manifest, self.root)
        self.manifest["hdr10_metadata_provenance"] = "MEASURED"
        self.assertEqual(MOD.validate(self.manifest, self.root)["files_verified"], 3)

    def test_directory_escape_rejected(self):
        self.manifest["output_path"] = "../something.mp4"
        with self.assertRaises(ValueError):
            MOD.validate(self.manifest, self.root)


if __name__ == "__main__":
    unittest.main()
