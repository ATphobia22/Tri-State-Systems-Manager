"""Integration tests for the resilient hydrology shell preflight.

These tests exercise only input validation and lock behavior. They never launch
HEC-RAS, mutate model geometry, publish GIS, or send notifications.
"""
from __future__ import annotations

import csv
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from datetime import datetime, timezone


REPO_ROOT = Path(__file__).resolve().parents[1]
PIPELINE = REPO_ROOT / "scripts" / "hydrology" / "tsm_pipeline.sh"


class HydrologyPipelineIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="tsm-hydro-test-")
        self.root = Path(self.temp.name)
        self.data = self.root / "data"
        self.logs = self.root / "logs"
        self.reports = self.root / "reports"
        self.data.mkdir()
        self.csv_path = self.data / "boundary.csv"
        self.evidence_path = self.data / "telemetry-evidence.json"
        self._write_csv()

    def tearDown(self) -> None:
        self.temp.cleanup()

    def _write_csv(self) -> None:
        with self.csv_path.open("w", newline="", encoding="utf-8") as stream:
            writer = csv.DictWriter(stream, fieldnames=("timestamp", "flow_cfs", "froude_number"))
            writer.writeheader()
            writer.writerow({"timestamp": "2026-10-15T12:00:00Z", "flow_cfs": "100", "froude_number": "0.3"})
            writer.writerow({"timestamp": "2026-10-15T12:15:00Z", "flow_cfs": "110", "froude_number": "0.35"})

    def _run(self, *, with_evidence: bool) -> subprocess.CompletedProcess[str]:
        if with_evidence:
            self.evidence_path.write_text(json.dumps({
                "verified": True,
                "gauge_id": "03378500",
                "observed_at": datetime.now(timezone.utc).isoformat(),
            }), encoding="utf-8")
        env = os.environ.copy()
        env.update({
            "TSM_DATA_DIR": str(self.data),
            "TSM_LOG_DIR": str(self.logs),
            "TSM_REPORT_DIR": str(self.reports),
            "TSM_HYDROGRAPH_CSV": str(self.csv_path),
            "TSM_TELEMETRY_EVIDENCE_JSON": str(self.evidence_path) if with_evidence else "",
            "TSM_GAUGE_ID": "03378500",
            "TSM_BOUNDARY": "WABASH_COMPONENT_03378500",
            "TSM_NORMAL_DEPTH_SLOPE_FT_FT": "0.0004",
        })
        return subprocess.run(
            ["bash", str(PIPELINE)],
            cwd=REPO_ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=False,
            timeout=15,
        )

    def test_missing_telemetry_evidence_fails_closed(self) -> None:
        result = self._run(with_evidence=False)
        self.assertEqual(result.returncode, 1)
        self.assertIn("telemetry evidence JSON is required", result.stdout + result.stderr)
        self.assertFalse(list(self.reports.glob("preflight-*.json")))

    def test_validated_inputs_still_cannot_launch_unverified_solver(self) -> None:
        result = self._run(with_evidence=True)
        self.assertEqual(result.returncode, 3, result.stdout + result.stderr)
        self.assertIn("PIPELINE_LOCKED", result.stdout)
        self.assertIn("no verified HEC-RAS-version-specific adapter is enabled", result.stdout)
        reports = list(self.reports.glob("preflight-*.json"))
        self.assertEqual(len(reports), 1)
        payload = json.loads(reports[0].read_text(encoding="utf-8"))
        self.assertEqual(payload["status"], "VALIDATED_FOR_REVIEW")
        self.assertIs(payload["execution_allowed"], False)

    def test_wrong_gauge_fails_closed_and_records_gate_report(self) -> None:
        self._run(with_evidence=True)
        self.evidence_path.write_text(json.dumps({
            "verified": True,
            "gauge_id": "03322000",
            "observed_at": datetime.now(timezone.utc).isoformat(),
        }), encoding="utf-8")
        # A second invocation with a mismatched evidence gauge must fail before
        # reaching the solver lock. Use a fresh report directory to avoid ambiguity.
        env = os.environ.copy()
        env.update({
            "TSM_DATA_DIR": str(self.data),
            "TSM_LOG_DIR": str(self.logs),
            "TSM_REPORT_DIR": str(self.root / "wrong-gauge-reports"),
            "TSM_HYDROGRAPH_CSV": str(self.csv_path),
            "TSM_TELEMETRY_EVIDENCE_JSON": str(self.evidence_path),
            "TSM_GAUGE_ID": "03378500",
            "TSM_BOUNDARY": "WABASH_COMPONENT_03378500",
            "TSM_NORMAL_DEPTH_SLOPE_FT_FT": "0.0004",
        })
        result = subprocess.run(
            ["bash", str(PIPELINE)], cwd=REPO_ROOT, env=env,
            capture_output=True, text=True, check=False, timeout=15,
        )
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        reports = list((self.root / "wrong-gauge-reports").glob("preflight-*.json"))
        self.assertEqual(len(reports), 1)
        payload = json.loads(reports[0].read_text(encoding="utf-8"))
        self.assertEqual(payload["status"], "PIPELINE_LOCKED")
        self.assertIs(payload["execution_allowed"], False)


if __name__ == "__main__":
    unittest.main()
