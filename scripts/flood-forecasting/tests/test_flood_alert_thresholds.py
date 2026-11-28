"""Regression: a USGS gage stage cannot be classified with NWS MTVI3 thresholds."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from run_all import classify_flood_stage
from tsm_config import FLOOD_STAGES


class StationSpecificFloodThresholdTests(unittest.TestCase):
    def test_new_harmony_cannot_inherit_mount_vernon_flood_thresholds(self):
        self.assertEqual(classify_flood_stage("03378500", 40.0, FLOOD_STAGES), "THRESHOLD_UNAVAILABLE")

    def test_old_shawneetown_cannot_inherit_mount_vernon_flood_thresholds(self):
        self.assertEqual(classify_flood_stage("03381700", 42.0, FLOOD_STAGES), "THRESHOLD_UNAVAILABLE")

    def test_valid_station_specific_thresholds_classify_only_that_station(self):
        self.assertEqual(classify_flood_stage("MTVI3", 40.0, FLOOD_STAGES), "MODERATE")
        self.assertEqual(classify_flood_stage("MTVI3", 20.0, FLOOD_STAGES), "BELOW_ACTION")

    def test_invalid_or_nonfinite_observation_is_not_assumed_safe(self):
        self.assertEqual(classify_flood_stage("MTVI3", float("nan"), FLOOD_STAGES), "OBSERVATION_UNAVAILABLE")

    def test_exact_threshold_boundaries(self):
        for stage, expected in ((29.99, "BELOW_ACTION"), (30.0, "ACTION"),
                                (35.0, "MINOR"), (38.0, "MODERATE"), (42.0, "MAJOR")):
            with self.subTest(stage=stage):
                self.assertEqual(classify_flood_stage("MTVI3", stage, FLOOD_STAGES), expected)

    def test_invalid_observation_types_and_infinity(self):
        for stage in (None, True, "40", float("inf"), float("-inf"), 10**1000):
            with self.subTest(stage=type(stage).__name__):
                self.assertEqual(classify_flood_stage("MTVI3", stage, FLOOD_STAGES), "OBSERVATION_UNAVAILABLE")

    def test_malformed_thresholds_fail_closed(self):
        for thresholds in ({}, {"action_ft": 30},
                           dict(FLOOD_STAGES["MTVI3"], moderate_ft=34),
                           dict(FLOOD_STAGES["MTVI3"], major_ft=float("inf")),
                           dict(FLOOD_STAGES["MTVI3"], action_ft=True)):
            with self.subTest(thresholds=thresholds):
                self.assertEqual(classify_flood_stage("MTVI3", 40.0, {"MTVI3": thresholds}), "THRESHOLD_UNAVAILABLE")


if __name__ == "__main__":
    unittest.main()
