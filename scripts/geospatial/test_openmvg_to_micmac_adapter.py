"""Synthetic adapter contract tests. No MicMac runtime or surveyed accuracy proof."""
from __future__ import annotations
import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from openmvg_to_micmac_adapter import convert_sfm_data

def fixture(model="pinhole_radial_k3", intrinsic_id=0, image="frame1.jpg"):
    disto = {
        "pinhole": {},
        "pinhole_radial_k1": {"disto_k1": [0.1]},
        "pinhole_radial_k3": {"disto_k3": [0.1, -0.01, 0.001]},
        "pinhole_brown_t2": {"disto_t2": [0.1, -0.01, 0.001, 0.002, 0.003]},
    }[model]
    return {
        "sfm_data_version": "0.3",
        "intrinsics": [{"key": intrinsic_id, "value": {"polymorphic_name": model,
            "ptr_wrapper": {"data": {"width": 1280, "height": 720,
            "focal_length": 900, "principal_point": [640, 360], **disto}}}}],
        "extrinsics": [{"key": 0, "value": {"rotation": [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
            "center": [10, 20, 30]}}],
        "views": [{"value": {"ptr_wrapper": {"data": {"filename": image,
            "id_intrinsic": intrinsic_id, "id_pose": 0, "id_view": 0}}}}],
    }

class AdapterTests(unittest.TestCase):
    def convert(self, data, *, crs="LOCAL_UNREFERENCED", datum="UNREFERENCED"):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "sfm_data.json"
            source.write_text(json.dumps(data), encoding="utf8")
            out = Path(tmp) / "Ori-openMVG"
            manifest = convert_sfm_data(source, out, crs, datum)
            path = out / "Orientation-frame1.jpg.xml"
            xml = path.read_text(encoding="utf8") if path.exists() else None
            return manifest, xml

    def test_orientation_transpose_and_receipts(self):
        manifest, xml = self.convert(fixture())
        self.assertEqual(manifest["converted_count"], 1)
        self.assertEqual(manifest["geodesy"]["evidence_class"], "DERIVED")
        self.assertFalse(manifest["micmac_runtime_validated"])
        self.assertFalse(manifest["geodetic_control_validated"])
        self.assertRegex(manifest["views"][0]["sha256"], r"^[0-9a-f]{64}$")
        self.assertRegex(next(iter(manifest["autocal_sha256"].values())), r"^[0-9a-f]{64}$")
        root = ET.fromstring(xml)
        self.assertEqual(root.findtext(".//Centre"), "10.00000000 20.00000000 30.00000000")
        self.assertEqual([float(x) for x in root.findtext(".//CodageMatr/L1").split()], [0., 1., 0.])

    def test_brown_tangential_distortion_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unsupported openMVG intrinsic"):
            self.convert(fixture(model="pinhole_brown_t2"))

    def test_image_filename_traversal_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unsafe image filename"):
            self.convert(fixture(image="../frame1.jpg"))

    def test_intrinsic_id_traversal_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unsafe intrinsic id"):
            self.convert(fixture(intrinsic_id="../../pwn"))

    def test_missing_source_crs_rejected(self):
        with self.assertRaisesRegex(ValueError, "Explicit source CRS"):
            self.convert(fixture(), crs=" ")

    def test_nonorthogonal_rotation_rejected(self):
        data = fixture()
        data["extrinsics"][0]["value"]["rotation"][0][0] = 2
        with self.assertRaisesRegex(ValueError, "orthogonality|determinant"):
            self.convert(data)

    def test_nonfinite_rotation_rejected(self):
        data = fixture()
        data["extrinsics"][0]["value"]["rotation"][0][0] = float("nan")
        with self.assertRaisesRegex(ValueError, "non-finite"):
            self.convert(data)

    def test_empty_pose_set_rejected(self):
        data = fixture()
        data["extrinsics"] = []
        with self.assertRaisesRegex(ValueError, "No oriented views"):
            self.convert(data)

    def test_focal_and_distortion_counts_rejected(self):
        data = fixture()
        data["intrinsics"][0]["value"]["ptr_wrapper"]["data"]["focal_length"] = 0
        with self.assertRaisesRegex(ValueError, "focal length"):
            self.convert(data)
        data = fixture()
        data["intrinsics"][0]["value"]["ptr_wrapper"]["data"]["disto_k3"] = [0.2]
        with self.assertRaisesRegex(ValueError, "coefficient count"):
            self.convert(data)

if __name__ == "__main__":
    unittest.main()
