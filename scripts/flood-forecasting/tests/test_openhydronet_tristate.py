#!/usr/bin/env python3
"""Tests for the TSM x OpenHydroNet adapter (openhydronet_tristate.py).

Smoke-test contract:
  - resolve_framework() VERIFies an Apache-2.0 clone, UNAVAILABLE otherwise
  - smoke_config() builds a Config dict the framework accepts
  - smoke_run() returns VERIFIED with honest SYNTHETIC labels, or UNAVAILABLE
  - run_all.py wires the 'openhydronet' step without breaking other steps

The full smoke_run test is skipped when OPENHYDRONET_HOME is not a verified
framework checkout, so the suite stays green off-machine (resilient, not
fail-closed).
"""

import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import openhydronet_tristate as ohn


class TestResolveFramework(unittest.TestCase):
    def test_default_home_verified(self):
        home, status = ohn.resolve_framework()
        # The dev VM holds the verified Apache-2.0 clone; on other machines
        # this reports UNAVAILABLE instead of failing.
        if Path(os.environ.get("OPENHYDRONET_HOME", ohn.DEFAULT_OPENHYDRONET_HOME)).is_dir():
            self.assertEqual(status, "verified")
            self.assertIsNotNone(home)
        else:
            self.assertIsNone(home)

    def test_missing_dir_unavailable(self):
        home, status = ohn.resolve_framework(Path("/nonexistent/ohnet"))
        self.assertIsNone(home)
        self.assertIn("UNAVAILABLE", status)

    def test_non_apache_license_unavailable(self, tmp=None):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            (p / "LICENSE").write_text("Proprietary License, all rights reserved.\n")
            (p / "googlehydrology").mkdir()
            (p / "googlehydrology" / "__init__.py").write_text("")
            home, status = ohn.resolve_framework(p)
            self.assertIsNone(home)
            self.assertIn("UNAVAILABLE", status)


class TestSmokeConfig(unittest.TestCase):
    def test_config_keys(self):
        cfg = ohn.smoke_config(seq_length=10, lead_time=2)
        self.assertEqual(cfg["model"], "mean_embedding_forecast_lstm")
        self.assertEqual(cfg["seq_length"], 10)
        self.assertEqual(cfg["lead_time"], 2)
        self.assertFalse(cfg["compile"])
        # shared 'meteo' group must match on both sides (framework asserts this)
        self.assertEqual(
            cfg["hindcast_inputs"]["meteo"], cfg["forecast_inputs"]["meteo"]
        )


class TestTristateYml(unittest.TestCase):
    def test_yml_parses(self):
        meta = ohn.load_tristate_yml()
        self.assertEqual(meta["status"], "parsed")
        self.assertEqual(len(meta["basins"]), 3)
        ids = {b["basin_id"] for b in meta["basins"]}
        self.assertEqual(
            ids,
            {"ohio_old_shawneetown", "wabash_new_harmony", "ohio_mount_vernon"},
        )


class TestSmokeRun(unittest.TestCase):
    def test_forward_pass(self):
        try:
            import torch  # noqa: F401
        except ImportError:
            self.skipTest("torch not installed")
        home, status = ohn.resolve_framework()
        if home is None:
            self.skipTest(f"no verified framework checkout: {status}")
        result = ohn.smoke_run(seq_length=10, lead_time=2)
        self.assertEqual(result["status"], "VERIFIED")
        self.assertEqual(result["input"]["label"], "SYNTHETIC")
        self.assertIn("MeanEmbeddingForecastLSTM", result["framework"]["model"])
        self.assertGreater(result["framework"]["parameters"], 0)
        for key, o in result["outputs"].items():
            self.assertTrue(o["all_finite"], f"{key} has non-finite values")
            self.assertEqual(o["label"], "SYNTHETIC")
        self.assertTrue(result["not_done"])  # honestly labeled gaps


class TestRunAllWiring(unittest.TestCase):
    def test_step_registered(self):
        import run_all

        self.assertIn("openhydronet", run_all.STEPS)
        self.assertIn("openhydronet", run_all.STEP_ORDER)
        # original steps untouched
        for s in [
            "ingest", "antecedent", "nowcast", "forecast", "rating",
            "alert", "bfe", "hydromt", "hydrofabric", "wres",
        ]:
            self.assertIn(s, run_all.STEPS)


if __name__ == "__main__":
    unittest.main()
