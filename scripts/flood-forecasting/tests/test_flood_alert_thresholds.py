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


if __name__ == "__main__":
    unittest.main()
