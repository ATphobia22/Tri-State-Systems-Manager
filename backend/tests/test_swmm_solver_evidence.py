"""Synthetic EPA SWMM report integrity tests; not a real solver run."""
import tempfile
import unittest
from pathlib import Path
from backend.solver_evidence_adapters import inspect_swmm_run
from backend.engineering_evidence import ExecutionState


class SwmmEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.model = root / "model.inp"
        self.rpt = root / "model.rpt"
        self.out = root / "model.out"
        self.model.write_text("[TITLE]\nSynthetic fixture\n")
        self.out.write_bytes(b"CI-SYNTHETIC-OUTPUT-NOT-SWMM")
        self.report(0.5, -0.25)

    def report(self, runoff: float, routing: float):
        self.rpt.write_text(
            "*************************\n"
            "Runoff Quantity Continuity\n"
            "*************************\n"
            "Total Precipitation ........ 1.000 2.000\n"
            f"Continuity Error (%) ..... {runoff}\n"
            "*************************\n"
            "Flow Routing Continuity\n"
            "*************************\n"
            "External Inflow ........ 1.000 2.000\n"
            f"Continuity Error (%) ..... {routing}\n"
            "*************************\n"
            "Analysis ended on: Mon Nov 09 00:00:00 2026\n"
        )

    def check(self):
        return inspect_swmm_run(
            run_id="swmm-fixture", solver_version="synthetic",
            input_file=self.model, report_file=self.rpt, output_file=self.out,
            max_runoff_continuity_error_percent=1.0,
            max_routing_continuity_error_percent=1.0,
        )

    def test_continuity_within_threshold_is_verified_as_report_evidence(self):
        checked = self.check()
        self.assertEqual(checked.state, ExecutionState.VERIFIED.value)
        self.assertEqual(len(checked.inputs), 1)
        self.assertEqual(len(checked.outputs), 2)

    def test_routing_threshold_blocks_verification(self):
        self.report(0.1, -1.1)
        self.assertEqual(self.check().state, ExecutionState.FAILED.value)

    def test_nonfinite_tolerance_rejected(self):
        checked = inspect_swmm_run(
            run_id="invalid-tolerance", solver_version="synthetic",
            input_file=self.model, report_file=self.rpt, output_file=self.out,
            max_runoff_continuity_error_percent=float("nan"),
            max_routing_continuity_error_percent=1.0,
        )
        self.assertEqual(checked.state, ExecutionState.NOT_EVALUATED.value)

    def test_unfinished_report_not_verified(self):
        self.rpt.write_text(self.rpt.read_text().replace("Analysis ended on:", "Analysis never ended on:"))
        self.assertEqual(self.check().state, ExecutionState.NOT_EVALUATED.value)

    def test_errors_are_not_convergence(self):
        self.rpt.write_text("ERROR 101: model input invalid\n" + self.rpt.read_text())
        self.assertEqual(self.check().state, ExecutionState.NOT_EVALUATED.value)


if __name__ == "__main__":
    unittest.main()
