from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile
import unittest

from tsm_runtime.boundary_flow_validator import validate_boundary_csv


class BoundaryFlowValidatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="tsm-boundary-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.now = datetime(2026, 10, 15, 12, 0, tzinfo=timezone.utc)

    def write_csv(self, rows: list[str]) -> Path:
        path = self.root / "boundary.csv"
        path.write_text(
            "timestamp,flow_cfs,froude_number\n" + "\n".join(rows) + "\n",
            encoding="utf-8",
        )
        return path

    @staticmethod
    def telemetry(now: datetime, gauge: str = "03378500") -> dict[str, object]:
        return {"verified": True, "gauge_id": gauge, "observed_at": now.isoformat()}

    def test_valid_series_only_passes_for_review(self) -> None:
        path = self.write_csv([
            "2026-10-15T11:30:00Z,1000,0.40",
            "2026-10-15T11:45:00Z,1100,0.45",
            "2026-10-15T12:00:00Z,1200,0.50",
        ])
        result = validate_boundary_csv(
            path, boundary="WABASH_COMPONENT_03378500", gauge_id="03378500",
            normal_depth_slope_ft_ft=0.0004,
            telemetry_evidence=self.telemetry(self.now), now=self.now,
        )
        self.assertTrue(result.valid)
        self.assertFalse(result.as_dict()["execution_allowed"])

    def test_wrong_gauge_locks_pipeline(self) -> None:
        path = self.write_csv([
            "2026-10-15T11:45:00Z,1000,0.4",
            "2026-10-15T12:00:00Z,1100,0.4",
        ])
        result = validate_boundary_csv(
            path, boundary="WABASH_COMPONENT_03378500", gauge_id="03322000",
            normal_depth_slope_ft_ft=0.0004,
            telemetry_evidence=self.telemetry(self.now, "03322000"), now=self.now,
        )
        self.assertEqual(result.status, "PIPELINE_LOCKED")
        self.assertTrue(any("requires configured gauge" in error for error in result.errors))

    def test_missing_timestamp_counts_as_gap(self) -> None:
        path = self.write_csv([
            "2026-10-15T11:15:00Z,1000,0.4",
            "2026-10-15T12:00:00Z,1100,0.4",
        ])
        result = validate_boundary_csv(
            path, boundary="WABASH_COMPONENT_03378500", gauge_id="03378500",
            normal_depth_slope_ft_ft=0.0004,
            telemetry_evidence=self.telemetry(self.now), now=self.now,
        )
        self.assertEqual(result.status, "PIPELINE_LOCKED")
        self.assertEqual(result.missing_records, 2)

    def test_froude_and_slope_thresholds_lock_pipeline(self) -> None:
        path = self.write_csv([
            "2026-10-15T11:45:00Z,1000,0.85",
            "2026-10-15T12:00:00Z,1100,0.90",
        ])
        result = validate_boundary_csv(
            path, boundary="WABASH_COMPONENT_03378500", gauge_id="03378500",
            normal_depth_slope_ft_ft=0.001,
            telemetry_evidence=self.telemetry(self.now), now=self.now,
        )
        self.assertEqual(result.status, "PIPELINE_LOCKED")
        self.assertTrue(any("slope must be within" in error for error in result.errors))
        self.assertTrue(any("Froude" in error for error in result.errors))

    def test_stale_telemetry_locks_pipeline(self) -> None:
        path = self.write_csv([
            "2026-10-15T11:45:00Z,1000,0.4",
            "2026-10-15T12:00:00Z,1100,0.4",
        ])
        evidence = self.telemetry(self.now - timedelta(hours=2))
        result = validate_boundary_csv(
            path, boundary="WABASH_COMPONENT_03378500", gauge_id="03378500",
            normal_depth_slope_ft_ft=0.0004,
            telemetry_evidence=evidence, now=self.now,
        )
        self.assertEqual(result.status, "PIPELINE_LOCKED")
        self.assertTrue(any("stale" in error for error in result.errors))


if __name__ == "__main__":
    unittest.main()
