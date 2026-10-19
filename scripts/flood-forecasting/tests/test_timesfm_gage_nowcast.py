"""Contract tests for the standalone TimesFM USGS data adapter."""

import importlib.util
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import pandas as pd


MODULE_PATH = Path(__file__).resolve().parents[1] / "timesfm-gage-nowcast.py"
SPEC = importlib.util.spec_from_file_location("timesfm_gage_nowcast", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class FetchUsgsGageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.response = Mock()
        self.response.raise_for_status.return_value = None

    @patch.dict("os.environ", {}, clear=True)
    @patch.object(MODULE.requests, "get")
    def test_uses_modern_continuous_api_and_preserves_valid_observations(self, get: Mock) -> None:
        self.response.json.return_value = {
            "features": [
                {
                    "properties": {
                        "time": "2026-10-18T12:00:00Z",
                        "value": "8.25",
                        "unit_of_measure": "ft",
                        "approval_status": "Provisional",
                    }
                },
                {
                    "properties": {
                        "time": "2026-10-18T11:45:00Z",
                        "value": "8.10",
                        "unit_of_measure": "ft",
                        "approval_status": "Approved",
                    }
                },
            ]
        }
        get.return_value = self.response

        result = MODULE.fetch_usgs_gage("03378500", "00065", days=2)

        args, kwargs = get.call_args
        self.assertEqual(
            args[0],
            "https://api.waterdata.usgs.gov/ogcapi/v1/collections/continuous/items",
        )
        self.assertEqual(kwargs["params"]["monitoring_location_id"], "USGS-03378500")
        self.assertEqual(kwargs["params"]["parameter_code"], "00065")
        self.assertIn("/", kwargs["params"]["datetime"])
        self.assertEqual(kwargs["timeout"], 30)
        self.assertEqual(
            list(result.columns),
            ["datetime", "value", "unit_of_measure", "approval_status", "qualifier", "source_uri", "retrieved_at"],
        )
        self.assertEqual(result["value"].tolist(), [8.10, 8.25])
        self.assertEqual(result["approval_status"].tolist(), ["Approved", "Provisional"])
        self.assertEqual(result["unit_of_measure"].tolist(), ["ft", "ft"])
        self.assertTrue(result["retrieved_at"].notna().all())
        self.assertTrue(pd.api.types.is_datetime64tz_dtype(result["datetime"].dtype))

    @patch.object(MODULE.requests, "get")
    def test_rejects_mixed_units(self, get: Mock) -> None:
        self.response.json.return_value = {
            "features": [
                {"properties": {"time": "2026-10-18T12:00:00Z", "value": "8.25", "unit_of_measure": "ft"}},
                {"properties": {"time": "2026-10-18T11:45:00Z", "value": "2.50", "unit_of_measure": "m"}},
            ]
        }
        get.return_value = self.response

        with self.assertRaisesRegex(ValueError, "inconsistent units"):
            MODULE.fetch_usgs_gage("03378500", "00060", days=2)

    @patch.object(MODULE.requests, "get")
    def test_rejects_metric_gage_height_without_explicit_conversion(self, get: Mock) -> None:
        self.response.json.return_value = {
            "features": [
                {"properties": {"time": "2026-10-18T12:00:00Z", "value": "2.50", "unit_of_measure": "m"}}
            ]
        }
        get.return_value = self.response

        with self.assertRaisesRegex(ValueError, "must be in feet"):
            MODULE.fetch_usgs_gage("03378500", "00065", days=2)

    @patch.object(MODULE.requests, "get")
    def test_rejects_empty_or_unusable_response(self, get: Mock) -> None:
        self.response.json.return_value = {"features": []}
        get.return_value = self.response

        with self.assertRaisesRegex(ValueError, "No valid continuous observations"):
            MODULE.fetch_usgs_gage("03378500", "00065", days=2)


if __name__ == "__main__":
    unittest.main()
