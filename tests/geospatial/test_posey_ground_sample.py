"""Regression tests: absent DEM samples must not masquerade as authoritative."""
import importlib.util
import unittest
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[2] / "scripts/geospatial/posey_ground_sample.py"
spec = importlib.util.spec_from_file_location("posey_ground_sample", SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TestProvenance(unittest.TestCase):
    def test_unavailable_cannot_claim_source_or_height(self):
        result = module.ground_elevation_fields(None)
        self.assertIsNone(result["groundElevationSource"])
        self.assertIsNone(result["groundElevationFt"])
        self.assertIsNone(result["groundElevationMethod"])
        self.assertEqual(result["groundElevationSampleCount"], 0)
        self.assertEqual(result["elevationCoverage"], "UNAVAILABLE")
        self.assertFalse(result["groundElevationRegulatoryCertified"])

    def test_local_sample_does_not_claim_survey_certification(self):
        result = module.ground_elevation_fields(
            (370, 371, 370.5, 3, "/tmp/tiles/IN2020_26700930_12.tif"))
        self.assertEqual(result["groundElevationFt"], 370.5)
        self.assertEqual(result["groundElevationSource"], "IN2020_26700930_12.tif")
        self.assertIn("LOCAL", result["groundElevationProvenanceStatus"])
        self.assertFalse(result["groundElevationRegulatoryCertified"])

    def test_invalid_samples_never_mark_coverage(self):
        for item in [(370, 371, float("nan"), 3, "dem.tif"),
                     (370, 371, 370.5, 0, "dem.tif"),
                     (370, 371, 370.5, 3, "")]:
            with self.subTest(item=item):
                self.assertEqual(
                    module.ground_elevation_fields(item)["elevationCoverage"],
                    "UNAVAILABLE",
                )


if __name__ == "__main__":
    unittest.main()
