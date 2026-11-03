#!/usr/bin/env python3
"""Regression tests for individual authoritative building acceptance records."""
import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("validate_building_acceptance_chain.py")
SPEC = importlib.util.spec_from_file_location("building_acceptance", SCRIPT)
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)


def valid_feature():
    return {
        "type": "Feature",
        "properties": {
            "OBJECTID": 123,
            "lidarHeightStatus": "OK",
            "heightProvenance": "OBSERVED",
            "lidarHeightM": 10.0,
            "lidarHeightFt": 32.8083989501,
            "lidarGroundElevM": 100.0,
            "lidarRoofElevM": 110.0,
            "lidarRoofPoints": 150,
            "lidarGroundPoints": 15,
            "lidarSource": "sample-classified-point-cloud",
            "lidarHeightMethod": "sample-roof-ground-difference",
            "lidarHeightUncertaintyM": 0.1,
            "lidarHeightConfidence": "MEDIUM",
            "canopyOcclusionStatus": "NOT_FLAGGED_BY_CLASS_5_SCREEN",
            "lidarHeightDatum": "NAVD88",
            "achievedLod": 2,
            "roofPlanes": [{"normal": [0.0, 0.0, 1.0], "d": 10.0, "inlier_count": 120}],
        },
    }


class BuildingAcceptanceRegressionTests(unittest.TestCase):
    def validate(self, feature):
        violations = []
        sid = validator.validate_feature(feature, 0, violations)
        self.assertEqual(sid, 123)
        return violations

    def test_valid_consistent_heights_and_lod2(self):
        self.assertEqual(self.validate(valid_feature()), [])

    def test_height_unit_mismatch_is_rejected(self):
        feature = valid_feature()
        feature["properties"]["lidarHeightFt"] = 100.0
        self.assertTrue(any("disagree" in msg for msg in self.validate(feature)))

    def test_negative_imperial_height_is_rejected(self):
        feature = valid_feature()
        feature["properties"]["lidarHeightFt"] = -1.0
        self.assertTrue(any("positive" in msg for msg in self.validate(feature)))

    def test_malformed_roof_plane_reports_violation(self):
        for malformed in (None, "not a plane", [1, 2, 3]):
            with self.subTest(malformed=malformed):
                feature = valid_feature()
                feature["properties"]["roofPlanes"] = [malformed]
                self.assertTrue(any("must be an object" in msg for msg in self.validate(feature)))

    def test_boolean_inlier_count_is_not_an_integer_count(self):
        feature = valid_feature()
        feature["properties"]["roofPlanes"][0]["inlier_count"] = True
        self.assertTrue(any("100 inliers" in msg for msg in self.validate(feature)))


    def test_conflicting_objectid_aliases_are_rejected(self):
        feature = valid_feature()
        feature["properties"]["igioObjectId"] = 124
        violations = []
        sid = validator.validate_feature(feature, 0, violations)
        self.assertIsNone(sid)
        self.assertTrue(any("conflicting source OBJECTID" in msg for msg in violations))

    def test_matching_objectid_alias_is_accepted(self):
        feature = valid_feature()
        feature["properties"]["igioObjectId"] = "123"
        self.assertEqual(self.validate(feature), [])

    def test_boolean_roof_or_ground_point_counts_are_rejected(self):
        for field, needle in (("lidarRoofPoints", "5 qualifying roof points"),
                              ("lidarGroundPoints", "3 qualifying ground points")):
            with self.subTest(field=field):
                feature = valid_feature()
                feature["properties"][field] = True
                self.assertTrue(any(needle in msg for msg in self.validate(feature)))


if __name__ == "__main__":
    unittest.main()
