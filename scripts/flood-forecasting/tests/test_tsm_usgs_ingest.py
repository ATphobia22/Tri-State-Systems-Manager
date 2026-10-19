"""Contract tests for the modern USGS Water Data Python adapters."""

import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import pandas as pd


MODULE_PATH = Path(__file__).resolve().parents[1] / "tsm_usgs_ingest.py"
SPEC = importlib.util.spec_from_file_location("tsm_usgs_ingest_test_module", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def make_frame(
    *,
    times=("2026-10-18T11:45:00Z", "2026-10-18T12:00:00Z"),
    values=("8.10", "8.25"),
    units=("ft", "ft"),
    approvals=("Approved", "Provisional"),
    qualifiers=(None, "ESTIMATED"),
    series=("stage-primary", "stage-primary"),
):
    return pd.DataFrame({
        "monitoring_location_id": ["USGS-03378500"] * len(times),
        "parameter_code": ["00065"] * len(times),
        "time_series_id": list(series),
        "time": list(times),
        "value": list(values),
        "unit_of_measure": list(units),
        "approval_status": list(approvals),
        "qualifier": list(qualifiers),
    })


class ModernUsgsIngestTests(unittest.TestCase):
    def setUp(self) -> None:
        self.package = types.ModuleType("dataretrieval")
        self.package.__path__ = []
        self.waterdata = types.ModuleType("dataretrieval.waterdata")
        self.package.waterdata = self.waterdata
        self.legacy_nwis = types.ModuleType("dataretrieval.nwis")
        self.legacy_nwis.get_iv = Mock()
        self.module_patch = patch.dict(
            sys.modules,
            {
                "dataretrieval": self.package,
                "dataretrieval.waterdata": self.waterdata,
                "dataretrieval.nwis": self.legacy_nwis,
            },
        )
        self.module_patch.start()
        self.addCleanup(self.module_patch.stop)

    def test_gage_height_uses_modern_continuous_api_and_preserves_quality(self) -> None:
        self.waterdata.get_continuous = Mock(
            return_value=(
                make_frame(),
                types.SimpleNamespace(
                    url="https://api.waterdata.usgs.gov/ogcapi/v1/collections/continuous/items"
                ),
            )
        )
        out = MODULE.get_gage_height("03378500", days=2)
        kwargs = self.waterdata.get_continuous.call_args.kwargs
        self.assertEqual(kwargs["monitoring_location_id"], "USGS-03378500")
        self.assertEqual(kwargs["parameter_code"], "00065")
        self.assertIn("/", kwargs["time"])
        self.assertTrue(kwargs["time"].endswith("Z"))
        self.assertTrue(kwargs["time"].split("/")[0].endswith("Z"))
        self.assertIn("approval_status", kwargs["properties"])
        self.assertIn("qualifier", kwargs["properties"])
        self.assertEqual(out["value_ft"].tolist(), [8.10, 8.25])
        self.assertEqual(out["approval_status"].tolist(), ["Approved", "Provisional"])
        self.assertTrue(pd.isna(out["qualifier"].iloc[0]))
        self.assertEqual(out["qualifier"].iloc[1], "ESTIMATED")
        self.assertEqual(out["unit_of_measure"].tolist(), ["ft", "ft"])
        self.assertTrue(out["datetime"].dt.tz is not None)
        self.legacy_nwis.get_iv.assert_not_called()

    def test_metric_gage_height_uses_explicit_exact_unit_conversion(self) -> None:
        frame = make_frame(
            times=("2026-10-18T12:00:00Z",),
            values=("2.5",),
            units=("m",),
            approvals=("Provisional",),
            qualifiers=(None,),
            series=("stage-primary",),
        )
        self.waterdata.get_continuous = Mock(return_value=(frame, types.SimpleNamespace(url=None)))
        out = MODULE.get_gage_height("03378500", days=2)
        self.assertAlmostEqual(out["value_ft"].iloc[0], 2.5 / 0.3048, places=8)
        self.assertEqual(out["source_value"].iloc[0], 2.5)
        self.assertEqual(out["source_unit"].iloc[0], "m")
        self.assertEqual(out["unit_conversion"].iloc[0], "METRES_TO_FEET_EXACT")

    def test_duplicate_timestamps_from_multiple_series_are_rejected(self) -> None:
        frame = make_frame(
            times=("2026-10-18T12:00:00Z", "2026-10-18T12:00:00Z"),
            values=("8.10", "9.15"),
            units=("ft", "ft"),
            approvals=("Approved", "Provisional"),
            qualifiers=(None, None),
            series=("tailwater", "headwater"),
        )
        self.waterdata.get_continuous = Mock(return_value=(frame, types.SimpleNamespace(url=None)))
        with self.assertRaisesRegex(ValueError, "Ambiguous duplicate timestamps"):
            MODULE.get_gage_height("03378500", days=2)

    def test_daily_discharge_uses_daily_collection_and_explicit_unit_conversion(self) -> None:
        frame = pd.DataFrame({
            "monitoring_location_id": ["USGS-03378500"],
            "parameter_code": ["00060"],
            "time_series_id": ["daily-flow"],
            "time": ["2026-10-18"],
            "value": ["1.0"],
            "unit_of_measure": ["m³/s"],
            "approval_status": ["Approved"],
            "qualifier": [None],
        })
        self.waterdata.get_daily = Mock(return_value=(frame, types.SimpleNamespace(url=None)))
        out = MODULE.get_daily_discharge("03378500", days=30)
        kwargs = self.waterdata.get_daily.call_args.kwargs
        self.assertEqual(kwargs["monitoring_location_id"], "USGS-03378500")
        self.assertEqual(kwargs["parameter_code"], "00060")
        self.assertTrue(kwargs["time"].split("/")[0].count("-") == 2)
        self.assertAlmostEqual(out["value_cfs"].iloc[0], 35.31466672148859, places=8)
        self.assertEqual(out["unit_conversion"].iloc[0], "CUBIC_METRES_PER_SECOND_TO_CFS_EXACT")
        self.assertFalse(hasattr(self.waterdata, "get_continuous"))

    def test_modern_api_failure_does_not_fall_back_to_legacy_nwis(self) -> None:
        self.waterdata.get_continuous = Mock(side_effect=RuntimeError("modern endpoint unavailable"))
        with self.assertRaisesRegex(RuntimeError, "modern endpoint unavailable"):
            MODULE.get_gage_height("03378500", days=2)
        self.legacy_nwis.get_iv.assert_not_called()

    def test_no_data_is_not_fabricated(self) -> None:
        empty = pd.DataFrame(columns=[
            "monitoring_location_id", "parameter_code", "time_series_id",
            "time", "value", "unit_of_measure", "approval_status", "qualifier",
        ])
        self.waterdata.get_continuous = Mock(return_value=(empty, types.SimpleNamespace(url=None)))
        with self.assertRaisesRegex(ValueError, "No continuous observations"):
            MODULE.get_gage_height("03378500", days=2)


if __name__ == "__main__":
    unittest.main()
