"""Artifact and science-boundary tests; numbers are synthetic fixtures, not calibrated models."""
from __future__ import annotations
import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from backend.hydrologic_coupling_acceptance import evaluate_coupling, inspect_manifest


class CouplingAcceptanceContractTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        directory = Path(self.tmp.name)
        self.manifest = {"runs": [], "exchanges": []}
        for i, engine in enumerate(("HEC-RAS", "MODFLOW-6", "EPA-SWMM")):
            source = directory / f"{i}-input.txt"
            result = directory / f"{i}-output.txt"
            source.write_text(f"CI synthetic input {engine}")
            result.write_text(f"CI synthetic output {engine}")
            self.manifest["runs"].append({
                "engine": engine, "runId": f"fixture-{i}", "version": "CI-fixture-v1",
                "horizontalCrs": "EPSG:2966", "verticalDatum": "NAVD88",
                "fluxUnits": "m3", "timeStepSeconds": "3600",
                "inputs": [{"path": str(source), "sha256": hashlib.sha256(source.read_bytes()).hexdigest()}],
                "outputs": [{"path": str(result), "sha256": hashlib.sha256(result.read_bytes()).hexdigest()}],
                "validation": {
                    "converged": True, "massBalanceErrorPercent": 0.1,
                    "maxMassBalanceErrorPercent": 2.0,
                    "benchmark": {
                        "observed": [1.0, 2.0, 3.0],
                        "predicted": [1.1, 2.1, 3.1],
                        "maxRmse": 0.2,
                        "reference": "SYNTHETIC_KNOWN_ANSWER_ONLY",
                    },
                },
            })
        for frm, to in (("HEC-RAS", "MODFLOW-6"), ("EPA-SWMM", "HEC-RAS")):
            self.manifest["exchanges"].append({
                "from": frm, "to": to, "timestamp": "2026-11-09T00:00:00Z",
                "horizontalCrs": "EPSG:2966", "verticalDatum": "NAVD88",
                "fluxUnits": "m3", "timeStepSeconds": "3600",
                "sourceVolume": 100.0, "targetVolume": 100.05,
                "maxAbsoluteVolumeDifference": 0.1,
            })

    def test_synthetic_known_answer_fixture_can_pass_without_regulatory_approval(self):
        checked = evaluate_coupling(self.manifest)
        self.assertTrue(checked["verified"])
        self.assertFalse(checked["regulatoryApproval"])
        self.assertEqual(len(checked["solverChecks"]), 3)
        self.assertEqual(len(checked["exchangeChecks"]), 2)

    def test_mass_balance_failure_blocks_coupling(self):
        payload = copy.deepcopy(self.manifest)
        payload["runs"][0]["validation"]["massBalanceErrorPercent"] = 2.01
        self.assertFalse(evaluate_coupling(payload)["verified"])

    def test_non_convergence_blocks_coupling(self):
        payload = copy.deepcopy(self.manifest)
        payload["runs"][1]["validation"]["converged"] = False
        self.assertFalse(evaluate_coupling(payload)["verified"])

    def test_benchmark_exceeds_declared_threshold(self):
        payload = copy.deepcopy(self.manifest)
        payload["runs"][2]["validation"]["benchmark"]["predicted"] = [100, 100, 100]
        self.assertFalse(evaluate_coupling(payload)["verified"])

    def test_flux_mismatch_blocks_coupling(self):
        payload = copy.deepcopy(self.manifest)
        payload["exchanges"][0]["targetVolume"] = 100.2
        self.assertFalse(evaluate_coupling(payload)["verified"])

    def test_source_and_target_datum_mismatch_rejected(self):
        payload = copy.deepcopy(self.manifest)
        payload["runs"][1]["verticalDatum"] = "EGM2008"
        with self.assertRaisesRegex(ValueError, "EXCHANGE_CRS_DATUM_UNIT_OR_TIMESTEP_MISMATCH"):
            evaluate_coupling(payload)

    def test_tampered_input_rejected(self):
        payload = copy.deepcopy(self.manifest)
        Path(payload["runs"][0]["inputs"][0]["path"]).write_text("tampered")
        with self.assertRaisesRegex(ValueError, "ARTIFACT_HASH_MISMATCH"):
            evaluate_coupling(payload)

    def test_missing_solver_and_unsourced_benchmark_rejected(self):
        payload = copy.deepcopy(self.manifest)
        payload["runs"].pop()
        with self.assertRaisesRegex(ValueError, "THREE_SOLVER"):
            evaluate_coupling(payload)
        payload = copy.deepcopy(self.manifest)
        payload["runs"][0]["validation"]["benchmark"]["reference"] = ""
        with self.assertRaisesRegex(ValueError, "BENCHMARK_THRESHOLD"):
            evaluate_coupling(payload)

    def test_manifest_on_disk_roundtrip(self):
        path = Path(self.tmp.name) / "manifest.json"
        path.write_text(json.dumps(self.manifest))
        self.assertTrue(inspect_manifest(str(path))["verified"])


if __name__ == "__main__":
    unittest.main()
