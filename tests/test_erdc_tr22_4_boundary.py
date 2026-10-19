"""Tests for the ERDC/CHL TR-22-4 review-only boundary arithmetic."""
from __future__ import annotations

import csv
from pathlib import Path
import tempfile
import unittest

from tsm_runtime.erdc_tr22_4_boundary import (
    COMBINED_GAUGE,
    WABASH_COMPONENT_GAUGES,
    derive_erdc_tr22_4_boundaries,
)


class ERDCBoundaryDerivationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="tsm-erdc-boundary-")
        self.root = Path(self.temp.name)
        self.stamp = "2026-10-15T12:00:00Z"
        self.values = {
            COMBINED_GAUGE: 1000.0,
            WABASH_COMPONENT_GAUGES[0]: 100.0,
            WABASH_COMPONENT_GAUGES[1]: 150.0,
            WABASH_COMPONENT_GAUGES[2]: 250.0,
        }
        self.paths = {gauge: self._write(gauge, [(self.stamp, flow)]) for gauge, flow in self.values.items()}

    def tearDown(self) -> None:
        self.temp.cleanup()

    def _write(self, gauge: str, rows: list[tuple[str, float]]) -> Path:
        path = self.root / f"{gauge}.csv"
        with path.open("w", newline="", encoding="utf-8") as stream:
            writer = csv.writer(stream)
            writer.writerow(["timestamp", "flow_cfs"])
            writer.writerows(rows)
        return path

    def test_derives_wabash_sum_and_j_t_myers_residual(self) -> None:
        result = derive_erdc_tr22_4_boundaries(self.paths)
        self.assertTrue(result.valid_for_review)
        self.assertEqual(result.records[0]["wabash_inflow_cfs"], 500.0)
        self.assertEqual(result.records[0]["j_t_myers_inflow_cfs"], 500.0)
        self.assertIs(result.as_dict()["execution_allowed"], False)

    def test_missing_gauge_fails_closed(self) -> None:
        result = derive_erdc_tr22_4_boundaries({
            gauge: path for gauge, path in self.paths.items() if gauge != COMBINED_GAUGE
        })
        self.assertEqual(result.status, "PIPELINE_LOCKED")
        self.assertIn("missing required gauge CSVs", result.errors[0])

    def test_timestamp_mismatch_fails_closed(self) -> None:
        gauge = WABASH_COMPONENT_GAUGES[0]
        self.paths[gauge] = self._write(gauge, [("2026-10-15T12:15:00Z", 100.0)])
        result = derive_erdc_tr22_4_boundaries(self.paths)
        self.assertEqual(result.status, "PIPELINE_LOCKED")
        self.assertTrue(any("timestamp grid differs" in error for error in result.errors))

    def test_negative_residual_fails_closed(self) -> None:
        self.paths[COMBINED_GAUGE] = self._write(COMBINED_GAUGE, [(self.stamp, 400.0)])
        result = derive_erdc_tr22_4_boundaries(self.paths)
        self.assertEqual(result.status, "PIPELINE_LOCKED")
        self.assertTrue(any("below the summed Wabash flow" in error for error in result.errors))

    def test_duplicate_timestamps_resilient(self) -> None:
        gauge = WABASH_COMPONENT_GAUGES[1]
        self.paths[gauge] = self._write(gauge, [(self.stamp, 150.0), (self.stamp, 151.0)])
        result = derive_erdc_tr22_4_boundaries(self.paths)
        self.assertEqual(result.status, "PIPELINE_LOCKED")
        self.assertTrue(any("duplicate timestamp" in error for error in result.errors))

    def test_naive_timestamp_fails_closed(self) -> None:
        gauge = WABASH_COMPONENT_GAUGES[2]
        self.paths[gauge] = self._write(gauge, [("2026-10-15T12:00:00", 250.0)])
        result = derive_erdc_tr22_4_boundaries(self.paths)
        self.assertEqual(result.status, "PIPELINE_LOCKED")
        self.assertTrue(any("UTC offset or Z" in error for error in result.errors))


if __name__ == "__main__":
    unittest.main()
