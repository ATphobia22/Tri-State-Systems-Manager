"""Synthetic source-identity and 5000-ft DEM tile-lattice regression tests."""
import importlib.util
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[2] / "scripts/geospatial/plan_posey_dem_recovery.py"
spec = importlib.util.spec_from_file_location("posey_dem_plan", MODULE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class TestTilePlan(unittest.TestCase):
    def test_single_tile_and_grid_boundary(self):
        self.assertEqual(
            mod.tile_names_for_bounds((2670001, 930001, 2674999, 934999)),
            ["IN2020_26700930_12.tif"],
        )
        self.assertEqual(
            mod.tile_names_for_bounds((2674999, 934999, 2675001, 935001)),
            ["IN2020_26700930_12.tif", "IN2020_26700935_12.tif",
             "IN2020_26750930_12.tif", "IN2020_26750935_12.tif"],
        )

    def test_invalid_or_overlarge_bounds_fail(self):
        for bounds in [(float("nan"), 930000, 2675000, 935000),
                       (2675000, 930000, 2670000, 935000),
                       (2670000, 930000, 4370000, 935000)]:
            with self.subTest(bounds=bounds), self.assertRaises(ValueError):
                mod.tile_names_for_bounds(bounds)

    def test_all_source_objectids_are_distinct(self):
        def feature(oid, x):
            return {"type": "Feature", "properties": {"igioObjectId": oid},
                    "geometry": {"type": "Polygon", "coordinates": [[
                        [x, 930001], [x + 100, 930001],
                        [x + 100, 930101], [x, 930101], [x, 930001]]]}}
        doc = {"type": "FeatureCollection",
               "features": [feature(123, 2670001), feature(456, 2675010)]}
        report = mod.plan(doc, expected_count=2, projected=True)
        self.assertEqual(report["authoritativeObjectIdCount"], 2)
        self.assertEqual(report["tileCount"], 2)
        self.assertEqual(report["tileNames"],
                         ["IN2020_26700930_12.tif", "IN2020_26750930_12.tif"])
        self.assertFalse(report["heightsVerified"])
        doc["features"][1]["properties"]["igioObjectId"] = 123
        with self.assertRaisesRegex(ValueError, "duplicate"):
            mod.plan(doc, expected_count=2, projected=True)

    def test_multipart_parts_not_reduced_to_single_exterior(self):
        doc = {"type": "FeatureCollection", "features": [{
            "type": "Feature", "properties": {"igioObjectId": 20},
            "geometry": {"type": "MultiPolygon", "coordinates": [
                [[[2670001, 930001], [2670101, 930001],
                  [2670101, 930101], [2670001, 930001]]],
                [[[2675101, 935101], [2675201, 935101],
                  [2675201, 935201], [2675101, 935101]]]
            ]}}]}
        report = mod.plan(doc, expected_count=1, projected=True)
        self.assertIn("IN2020_26750935_12.tif", report["tileNames"])
        self.assertNotIn("IN2020_26700935_12.tif", report["tileNames"])

    def test_invalid_nonfinite_geometry_fails(self):
        doc = {"type": "FeatureCollection", "features": [{
            "type": "Feature", "properties": {"igioObjectId": 4},
            "geometry": {"type": "Polygon", "coordinates": [[
                [float("nan"), 930001], [2670200, 930001],
                [2670200, 930200], [float("nan"), 930001]]]}}]}
        with self.assertRaises(ValueError):
            mod.plan(doc, expected_count=1, projected=True)

    def test_staging_missing_is_not_a_height_proof(self):
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as d:
            result = mod.audit_staged_tiles({"tileNames":["IN2020_26700930_12.tif"]},
                                            Path(d))
            self.assertEqual(result["missingCount"], 1)
            self.assertFalse(result["stagedMetadataAuditPassed"])
            self.assertFalse(result["rasterPixelCoverageVerified"])


if __name__ == "__main__":
    unittest.main()
