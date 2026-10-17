from __future__ import annotations

import importlib.util
import json
import math
import unittest
from unittest.mock import patch
from datetime import datetime, timedelta
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[2] / "scripts" / "hydrology" / "hms-ras-handoff.py"
SPEC = importlib.util.spec_from_file_location("tsm_hms_ras_handoff", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
HANDOFF = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HANDOFF)


class FakeFrame:
    def __init__(self, times, values, units="CFS"):
        self.index = times
        self.columns = ["value"]
        self.empty = len(values) == 0
        self.attrs = {"units": units}
        self._values = values

    def __getitem__(self, key):
        if key != "value":
            raise KeyError(key)
        return self._values


class HecHmsRasHandoffTests(unittest.TestCase):
    def setUp(self):
        self.times = [
            datetime(2026, 1, 1, 0, 0),
            datetime(2026, 1, 1, 1, 0),
            datetime(2026, 1, 1, 2, 0),
        ]

    def test_vcs_distribution_pin_requires_exact_version_and_commit(self):
        class FakeDistribution:
            version = HANDOFF.HMS_COMMANDER_VERSION
            def read_text(self, name):
                self_name = name
                if self_name != "direct_url.json":
                    return None
                return json.dumps({
                    "url": "https://github.com/ATphobia22/hms-commander.git",
                    "vcs_info": {
                        "vcs": "git",
                        "commit_id": HANDOFF.HMS_COMMANDER_SOURCE_COMMIT,
                    },
                })
        with patch.object(HANDOFF.importlib.metadata, "distribution", return_value=FakeDistribution()):
            self.assertEqual(
                HANDOFF._verify_vcs_distribution(
                    "hms-commander", HANDOFF.HMS_COMMANDER_VERSION,
                    HANDOFF.HMS_COMMANDER_SOURCE_COMMIT,
                ),
                (HANDOFF.HMS_COMMANDER_VERSION, HANDOFF.HMS_COMMANDER_SOURCE_COMMIT),
            )
        fake = FakeDistribution()
        fake.read_text = lambda name: json.dumps({
            "url": "https://github.com/ATphobia22/hms-commander.git",
            "vcs_info": {"vcs": "git", "commit_id": "0" * 40},
        })
        with patch.object(HANDOFF.importlib.metadata, "distribution", return_value=fake):
            with self.assertRaisesRegex(HANDOFF.HandoffError, "does not match pinned"):
                HANDOFF._verify_vcs_distribution(
                    "hms-commander", HANDOFF.HMS_COMMANDER_VERSION,
                    HANDOFF.HMS_COMMANDER_SOURCE_COMMIT,
                )

    def test_dss_pathname_parser_handles_blank_d_part_and_blank_a_part(self):
        regular = HANDOFF.parse_dss_pathname("/BASIN/OUTLET/FLOW//1HOUR/RUN:RUN1/")
        self.assertEqual(regular, ("BASIN", "OUTLET", "FLOW", "", "1HOUR", "RUN:RUN1"))
        blank_a = HANDOFF.parse_dss_pathname("//OUTLET/FLOW/01JAN2026/1HOUR/RUN1/")
        self.assertEqual(blank_a, ("", "OUTLET", "FLOW", "01JAN2026", "1HOUR", "RUN1"))

    def test_dss_pathname_parser_rejects_wrong_component_count_or_empty_required_part(self):
        for pathname in ("/BASIN/OUTLET/FLOW/1HOUR/RUN1/", "/BASIN/OUTLET//DATE/1HOUR/RUN1/"):
            with self.subTest(pathname=pathname), self.assertRaises(ValueError):
                HANDOFF.parse_dss_pathname(pathname)

    def test_unit_conversions_are_explicit_and_correct(self):
        cms = HANDOFF.convert_flow_values(
            [1.0, 10.0], source_units="CFS", target_units="CMS",
            conversion_method="CFS_TO_CMS_0.028316846592",
        )
        self.assertAlmostEqual(cms[0], 0.028316846592, places=12)
        self.assertAlmostEqual(cms[1], 0.28316846592, places=12)
        cfs = HANDOFF.convert_flow_values(
            [1.0], source_units="CMS", target_units="CFS",
            conversion_method="CMS_TO_CFS_35.314666721489",
        )
        self.assertAlmostEqual(cfs[0], 35.314666721489, places=10)
        with self.assertRaises(ValueError):
            HANDOFF.convert_flow_values(
                [1.0], source_units="CFS", target_units="CMS",
                conversion_method="NONE_EXACT_VALUES",
            )

    def test_valid_times_require_uniform_interval_and_explicit_time_zone(self):
        local, utc = HANDOFF.validate_local_times(
            self.times, time_zone="America/Chicago", interval="1HOUR"
        )
        self.assertEqual(local, self.times)
        self.assertEqual(len(utc), 3)
        self.assertEqual((utc[1] - utc[0]).total_seconds(), 3600)
        with self.assertRaises(ValueError):
            HANDOFF.validate_local_times(
                [self.times[0], self.times[2]], time_zone="America/Chicago", interval="1HOUR"
            )
        with self.assertRaises(ValueError):
            HANDOFF.validate_local_times(
                self.times, time_zone="Not/A_Real_Zone", interval="1HOUR"
            )

    def test_daylight_saving_ambiguous_and_nonexistent_times_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "ambiguous"):
            HANDOFF.validate_local_times(
                [datetime(2026, 11, 1, 1, 0), datetime(2026, 11, 1, 2, 0)],
                time_zone="America/Chicago", interval="1HOUR"
            )
        with self.assertRaisesRegex(ValueError, "nonexistent"):
            HANDOFF.validate_local_times(
                [datetime(2026, 3, 8, 2, 0), datetime(2026, 3, 8, 3, 0)],
                time_zone="America/Chicago", interval="1HOUR"
            )

    def test_offset_change_inside_series_is_rejected_even_when_local_clock_times_are_valid(self):
        with self.assertRaisesRegex(ValueError, "UTC offset changed"):
            HANDOFF.validate_local_times(
                [datetime(2026, 3, 7, 12, 0), datetime(2026, 3, 8, 12, 0)],
                time_zone="America/Chicago",
                interval="1DAY",
            )

    def test_frame_validation_checks_exact_path_units_interval_and_quality(self):
        frame = FakeFrame(self.times, [20.0, 40.0, 30.0])
        local, utc, values, summary = HANDOFF.validate_hydrograph_frame(
            frame,
            pathname="/BASIN/OUTLET/FLOW//1HOUR/RUN:RUN1/",
            element_name="OUTLET", run_name="RUN1",
            interval="1HOUR", source_units="CFS", target_units="CFS",
            conversion_method="NONE_EXACT_VALUES", time_zone="America/Chicago",
        )
        self.assertEqual(local, self.times)
        self.assertEqual(values, [20.0, 40.0, 30.0])
        self.assertEqual(summary["point_count"], 3)
        self.assertEqual(summary["maximum_flow"], 40.0)
        self.assertEqual(summary["trapezoidal_volume_ft3"], 234000.0)
        self.assertEqual(summary["status"], "FORMAT_AND_UNIT_CONTRACT_VALIDATED_HYDROLOGY_UNVALIDATED")

    def test_written_target_dss_round_trip_requires_exact_time_axis_and_values(self):
        local, utc = HANDOFF.validate_local_times(
            self.times, time_zone="America/Chicago", interval="1HOUR"
        )
        report = HANDOFF.validate_written_hydrograph_frame(
            FakeFrame(self.times, [20.0, 40.0, 30.0], units="CFS"),
            pathname="/RAS/UPSTREAM/FLOW//1HOUR/RAS_RUN1/",
            target_element_name="UPSTREAM",
            interval="1HOUR",
            units="CFS",
            time_zone="America/Chicago",
            expected_local_times=local,
            expected_utc_times=utc,
            expected_values=[20.0, 40.0, 30.0],
        )
        self.assertEqual(report["status"], "PASS")
        self.assertTrue(report["timestamps_exact"])
        self.assertTrue(report["values_within_tolerance"])
        self.assertEqual(report["point_count"], 3)
        self.assertEqual(report["maximum_absolute_error"], 0.0)

    def test_written_target_dss_round_trip_rejects_shifted_timestamps(self):
        local, utc = HANDOFF.validate_local_times(
            self.times, time_zone="America/Chicago", interval="1HOUR"
        )
        shifted = [self.times[0], self.times[1], self.times[2] + timedelta(hours=1)]
        with self.assertRaisesRegex(ValueError, "gap, duplicate, or irregular timestamp"):
            HANDOFF.validate_written_hydrograph_frame(
                FakeFrame(shifted, [20.0, 40.0, 30.0], units="CFS"),
                pathname="/RAS/UPSTREAM/FLOW//1HOUR/RAS_RUN1/",
                target_element_name="UPSTREAM",
                interval="1HOUR",
                units="CFS",
                time_zone="America/Chicago",
                expected_local_times=local,
                expected_utc_times=utc,
                expected_values=[20.0, 40.0, 30.0],
            )

    def test_written_target_dss_round_trip_rejects_changed_values(self):
        local, utc = HANDOFF.validate_local_times(
            self.times, time_zone="America/Chicago", interval="1HOUR"
        )
        with self.assertRaisesRegex(HANDOFF.HandoffError, "read-back values differ"):
            HANDOFF.validate_written_hydrograph_frame(
                FakeFrame(self.times, [20.0, 40.5, 30.0], units="CFS"),
                pathname="/RAS/UPSTREAM/FLOW//1HOUR/RAS_RUN1/",
                target_element_name="UPSTREAM",
                interval="1HOUR",
                units="CFS",
                time_zone="America/Chicago",
                expected_local_times=local,
                expected_utc_times=utc,
                expected_values=[20.0, 40.0, 30.0],
            )

    def test_frame_validation_rejects_unit_mismatch_gaps_and_negative_flows(self):
        frame = FakeFrame(self.times, [10.0, 20.0, 10.0], units="CMS")
        with self.assertRaisesRegex(ValueError, "mismatch"):
            HANDOFF.validate_hydrograph_frame(
                frame, pathname="/BASIN/OUTLET/FLOW//1HOUR/RUN1/",
                element_name="OUTLET", run_name="RUN1", interval="1HOUR",
                source_units="CFS", target_units="CFS", conversion_method="NONE_EXACT_VALUES",
                time_zone="America/Chicago",
            )
        frame = FakeFrame(self.times, [10.0, -1.0, 2.0])
        with self.assertRaisesRegex(ValueError, "negative"):
            HANDOFF.validate_hydrograph_frame(
                frame, pathname="/BASIN/OUTLET/FLOW//1HOUR/RUN1/",
                element_name="OUTLET", run_name="RUN1", interval="1HOUR",
                source_units="CFS", target_units="CFS", conversion_method="NONE_EXACT_VALUES",
                time_zone="America/Chicago",
            )
        frame = FakeFrame(self.times, [10.0, math.nan, 2.0])
        with self.assertRaisesRegex(ValueError, "finite"):
            HANDOFF.validate_hydrograph_frame(
                frame, pathname="/BASIN/OUTLET/FLOW//1HOUR/RUN1/",
                element_name="OUTLET", run_name="RUN1", interval="1HOUR",
                source_units="CFS", target_units="CFS", conversion_method="NONE_EXACT_VALUES",
                time_zone="America/Chicago",
            )

    def test_frame_validation_requires_exact_element_run_and_flow_record(self):
        frame = FakeFrame(self.times, [10.0, 20.0, 30.0])
        with self.assertRaisesRegex(ValueError, "element"):
            HANDOFF.validate_hydrograph_frame(
                frame, pathname="/BASIN/OTHER/FLOW//1HOUR/RUN1/",
                element_name="OUTLET", run_name="RUN1", interval="1HOUR",
                source_units="CFS", target_units="CFS", conversion_method="NONE_EXACT_VALUES",
                time_zone="America/Chicago",
            )
        with self.assertRaisesRegex(ValueError, "FLOW"):
            HANDOFF.validate_hydrograph_frame(
                frame, pathname="/BASIN/OUTLET/STAGE//1HOUR/RUN1/",
                element_name="OUTLET", run_name="RUN1", interval="1HOUR",
                source_units="CFS", target_units="CFS", conversion_method="NONE_EXACT_VALUES",
                time_zone="America/Chicago",
            )
        with self.assertRaisesRegex(ValueError, "F-part"):
            HANDOFF.validate_hydrograph_frame(
                frame, pathname="/BASIN/OUTLET/FLOW//1HOUR/RUN2/",
                element_name="OUTLET", run_name="RUN1", interval="1HOUR",
                source_units="CFS", target_units="CFS", conversion_method="NONE_EXACT_VALUES",
                time_zone="America/Chicago",
            )


if __name__ == "__main__":
    unittest.main()
