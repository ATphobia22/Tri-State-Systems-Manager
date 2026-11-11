import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

elevation = load("elevation", "scripts/engineering/evaluate_elevation_screening.py")
packager = load("packager", "scripts/engineering/package_evidence.py")

class EvidenceSafetyTests(unittest.TestCase):
    def test_unmatched_zone_is_never_compliant(self):
        self.assertEqual(elevation.evaluate({"structure_id": "A", "flood_zone_intersection": False})["status"], "NOT_EVALUATED")

    def test_missing_bfe_not_zero(self):
        row = self.valid_row()
        del row["bfe_elevation"]
        self.assertEqual(elevation.evaluate(row)["status"], "NOT_EVALUATED")

    def test_centroid_is_not_surveyed_lag(self):
        row = self.valid_row()
        row["lag_source_type"] = "dem_centroid"
        self.assertEqual(elevation.evaluate(row)["reason"], "LAG_NOT_SURVEY_VERIFIED")

    def test_mixed_datum_rejected(self):
        row = self.valid_row()
        row["bfe_vertical_datum"] = "NGVD29"
        self.assertEqual(elevation.evaluate(row)["status"], "NOT_EVALUATED")

    def test_threshold_is_only_screening(self):
        row = self.valid_row()
        result = elevation.evaluate(row)
        self.assertEqual(result["status"], "SCREENING_THRESHOLD_MET")
        self.assertFalse(result["regulatory_determination"])

    def test_incomplete_package_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "report.pdf").write_bytes(b"%PDF-1.4")
            with self.assertRaisesRegex(ValueError, "Required artifacts missing"):
                packager.package(root, root.parent / (root.name + ".zip"), "test")

    def test_hashes_and_manifest(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            for name in packager.REQUIRED:
                (root / name).write_bytes(b"test")
            result = packager.package(root, root.parent / (root.name + ".zip"), "Mount Vernon")
            self.assertTrue(result["complete"])
            self.assertEqual(len(result["artifacts"]), 5)
            self.assertFalse(result["agency_approved"])

    @staticmethod
    def valid_row():
        return {"structure_id": "A", "source_sha256": "a" * 64,
                "source_id": "test-source", "crs": "EPSG:2966",
                "vertical_datum": "NAVD88", "elevation_units": "ft",
                "lag_elevation": 377.2, "bfe_elevation": 375.0,
                "rule_id": "example-reviewed-rule", "rule_verified": True,
                "freeboard_ft": 1.0, "lag_source_type": "surveyed_lag",
                "flood_zone_intersection": True}

if __name__ == "__main__":
    unittest.main()
