#!/usr/bin/env python3
"""Regression tests for honest, fail-closed hydrology stage reporting."""
from __future__ import annotations

from contextlib import redirect_stderr, redirect_stdout
import importlib.util
import io
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

REPO_ROOT = Path(__file__).resolve().parents[1]
FLOODING_DIR = REPO_ROOT / "scripts" / "flood-forecasting"
sys.path.insert(0, str(FLOODING_DIR))


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module at {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


RAS2FIM = _load_module("tsm_ras2fim_tristate_test", FLOODING_DIR / "ras2fim_tristate.py")
RUN_ALL = _load_module("tsm_flood_forecast_run_all_test", FLOODING_DIR / "run_all.py")


class Ras2FimFailClosedTests(unittest.TestCase):
    def test_generator_raises_not_implemented_and_does_not_create_output(self) -> None:
        with tempfile.TemporaryDirectory(prefix="tsm-ras2fim-test-") as temp:
            output = Path(temp) / "inundation-output"
            with self.assertRaisesRegex(NotImplementedError, "does not execute HEC-RAS"):
                RAS2FIM.generate_inundation_library("candidate.prj", [1000.0], output)
            self.assertFalse(output.exists(), "an unavailable solver must not create an output directory")

    def test_cli_model_generation_exits_nonzero_and_reports_no_run(self) -> None:
        with tempfile.TemporaryDirectory(prefix="tsm-ras2fim-test-") as temp:
            RAS2FIM.OUT_DIR = Path(temp) / "ras2fim-output"
            stderr = io.StringIO()
            with mock.patch.object(
                sys,
                "argv",
                ["ras2fim_tristate.py", "--ras-project", "candidate.prj", "--flows", "1000,5000"],
            ), redirect_stderr(stderr):
                with self.assertRaises(SystemExit) as exc:
                    RAS2FIM.main()
            self.assertEqual(exc.exception.code, 2)
            self.assertIn("Inundation generation is not implemented", stderr.getvalue())
            self.assertIn("No model run was performed", stderr.getvalue())
            self.assertFalse(RAS2FIM.OUT_DIR.exists())

    def test_cli_requires_project_and_flows_together(self) -> None:
        stderr = io.StringIO()
        with mock.patch.object(sys, "argv", ["ras2fim_tristate.py", "--ras-project", "candidate.prj"]), redirect_stderr(stderr):
            with self.assertRaises(SystemExit) as exc:
                RAS2FIM.main()
        self.assertEqual(exc.exception.code, 2)
        self.assertIn("--ras-project and --flows must be supplied together", stderr.getvalue())

    def test_cli_rejects_non_finite_discharge_before_any_run(self) -> None:
        stderr = io.StringIO()
        with mock.patch.object(
            sys,
            "argv",
            ["ras2fim_tristate.py", "--ras-project", "candidate.prj", "--flows", "1000,NaN"],
        ), redirect_stderr(stderr):
            with self.assertRaises(SystemExit) as exc:
                RAS2FIM.main()
        self.assertEqual(exc.exception.code, 2)
        self.assertIn("finite, non-negative discharges", stderr.getvalue())

    def test_rating_curve_stage_is_not_reported_as_success_when_only_listing_models(self) -> None:
        output = io.StringIO()
        with mock.patch.object(RUN_ALL, "run_script", return_value=True), redirect_stdout(output):
            self.assertFalse(RUN_ALL.step_rating())
        self.assertIn("does not execute HEC-RAS/ras2fim", output.getvalue())

    def test_unconfigured_forecast_and_unexecuted_hydrofabric_are_unavailable(self) -> None:
        output = io.StringIO()
        with redirect_stdout(output):
            self.assertFalse(RUN_ALL.step_forecast())
            self.assertFalse(RUN_ALL.step_hydrofabric())
        self.assertIn("No operational forecast was retrieved or produced", output.getvalue())
        self.assertIn("extraction has not been executed", output.getvalue())


if __name__ == "__main__":
    unittest.main()
