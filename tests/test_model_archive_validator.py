"""Unit tests for the archive validator's native HEC-RAS geometry scan."""
from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = REPO_ROOT / "scripts" / "hydrology"
if not SCRIPT_DIR.exists():  # Supports running this file in a standalone test fixture.
    SCRIPT_DIR = Path(__file__).resolve().parent
SCRIPT_PATH = SCRIPT_DIR / "validate_model_archives.py"
sys.path.insert(0, str(SCRIPT_DIR))
spec = importlib.util.spec_from_file_location("validate_model_archives", SCRIPT_PATH)
validator = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = validator
spec.loader.exec_module(validator)


class HecRasGeometryInspectionTests(unittest.TestCase):
    def test_archive_report_exposes_native_cut_line_extent_and_does_not_claim_overlap(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            zip_path = root / "model.zip"
            coordinate_lines = "\n".join(
                "".join(f"{value:16.3f}" for value in pair)
                for pair in [(2686500.0, 947400.0), (2686600.0, 947500.0), (2686700.0, 947600.0)]
            )
            geometry = (
                "GIS Map Projection=STATEPLANE\n"
                "GIS Projection Zone=2966\n"
                "GIS Datum=NAD83\n"
                "GIS Vertical Datum=\n"
                "XS GIS Cut Line= 3\n"
                f"{coordinate_lines}\n"
                "River Reach= Ohio River, Main Reach\n"
            )
            with zipfile.ZipFile(zip_path, "w") as archive:
                archive.writestr("test.prj", "Test project\n")
                archive.writestr("test.g01", geometry)
                archive.writestr("test.f01", "flow file\n")
            report = validator.inspect_archive(zip_path, root)
            self.assertIn("gis_geometry", report)
            spatial = report["gis_geometry"]
            self.assertEqual(spatial["status"], "PARSED")
            self.assertEqual(spatial["coordinate_pair_count"], 3)
            self.assertEqual(spatial["native_xy_bounds"], {
                "min_x": 2686500.0, "min_y": 947400.0,
                "max_x": 2686700.0, "max_y": 947600.0,
            })
            self.assertEqual(spatial["spatial_overlap"], "NOT_COMPUTED")
            self.assertEqual(spatial["spatial_compatibility"], "NOT_VERIFIED")
            self.assertEqual(report["candidate_crs_codes"], ["EPSG:2966"])
            self.assertEqual(report["spatial_reference_claims"][0]["gis_vertical_datum"], "")

    def test_incomplete_cut_line_does_not_inflate_native_extent(self) -> None:
        parser = getattr(validator, "inspect_gis_cut_lines", None)
        self.assertTrue(callable(parser), "validator must provide a testable HEC-RAS cut-line parser")
        result = parser(
            "XS GIS Cut Line= 3\n2686500.0 947400.0\nRiver Reach= Ohio River, Main Reach\n",
            "test.g01",
        )
        self.assertEqual(result["status"], "PARTIAL_PARSE")
        self.assertIsNone(result["raw_xy_bounds"])
        self.assertTrue(result["errors"])


if __name__ == "__main__":
    unittest.main()
