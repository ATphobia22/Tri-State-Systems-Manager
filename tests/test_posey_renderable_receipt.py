"""Source-anchored 2D footprint vs. provisional 3D coverage regression tests."""
import hashlib
import importlib.util
import json
import unittest
from pathlib import Path

FILE = Path(__file__).resolve().parents[1] / "scripts/geospatial/posey_renderable_receipt.py"
spec = importlib.util.spec_from_file_location("posey_renderable_receipt", FILE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PoseyCoverageTests(unittest.TestCase):
    def samples(self):
        ring = [[[0, 0], [1, 0], [1, 1], [0, 0]]]
        base = {
            "county": "Posey", "lidarHeightStatus": "OK",
            "heightProvenance": "OBSERVED", "lidarHeightM": 2.0,
            "lidarHeightFt": 6.561679790026246,
            "lidarGroundElevM": 100.0, "lidarRoofElevM": 102.0,
            "lidarHeightDatum": "NAVD88",
            "lidarSource": "synthetic-test", "lidarHeightMethod": "synthetic-test",
        }
        ok = {"type": "Feature", "properties": {**base, "igioObjectId": 12},
              "geometry": {"type": "Polygon", "coordinates": ring}}
        missing = {"type": "Feature", "properties": {
            **base, "igioObjectId": 20, "lidarHeightStatus": "NO_QUALIFYING_ROOF"
        }, "geometry": {"type": "Polygon", "coordinates": ring}}
        ids = [12, 20]
        source = {
            "schema_version": "tsm.indiana-posey-source-inventory.v1",
            "source_identity_complete": True,
            "official_feature_count": 2,
            "official_sorted_objectids_sha256": hashlib.sha256(module.canonical(ids)).hexdigest(),
            "source": "https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0",
        }
        return source, {"type": "FeatureCollection", "features": [missing, ok]}

    def test_2d_identity_complete_with_partial_explicit_3d_coverage(self):
        source, geo = self.samples()
        report, preview = module.audit(source, geo)
        self.assertEqual(report["authoritative_2d_feature_count"], 2)
        self.assertEqual(report["provisional_3d_visualization_eligible"], 1)
        self.assertEqual(report["height_unavailable_or_unaccepted"], 1)
        self.assertFalse(report["complete_3d_county_coverage"])
        self.assertFalse(report["dem_samples_independently_verified"])
        self.assertFalse(report["regulatory_use"])
        self.assertEqual([f["properties"]["igioObjectId"] for f in preview["features"]], [12])

    def test_missing_or_changed_source_identity_cannot_be_suppressed(self):
        source, geo = self.samples()
        geo["features"][0]["properties"]["igioObjectId"] = 77
        with self.assertRaises(ValueError):
            module.audit(source, geo)

    def test_duplicate_id_cannot_be_counted_twice(self):
        source, geo = self.samples()
        geo["features"][0]["properties"]["igioObjectId"] = 12
        with self.assertRaises(ValueError):
            module.audit(source, geo)

    def test_bad_units_and_unknown_datum_are_not_eligible(self):
        source, geo = self.samples()
        props = geo["features"][1]["properties"]
        props["lidarHeightDatum"] = "UNKNOWN"
        report, _ = module.audit(source, geo)
        self.assertEqual(report["provisional_3d_visualization_eligible"], 0)
        self.assertEqual(report["classification_counts"]["VERTICAL_DATUM_UNVERIFIED"], 1)
        props["lidarHeightDatum"] = "NAVD88"
        props["lidarHeightFt"] = 900
        report, _ = module.audit(source, geo)
        self.assertEqual(report["classification_counts"]["HEIGHT_UNITS_INCONSISTENT"], 1)


if __name__ == "__main__":
    unittest.main()
