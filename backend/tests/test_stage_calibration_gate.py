"""No-data, synthetic-fixture tests of an artifact-bound stage assessment gate."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).parents[1] / "engineering/stage_calibration_gate.py"
spec = importlib.util.spec_from_file_location("tsm_stage_calibration_gate", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class CalibrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.policy = {
            "modelEngine": "HEC-RAS",
            "runId": "synthetic-unit-test",
            "modelVersion": "test-fixture-only",
            "thresholdAuthority": "USER_DECLARED_REVIEW_POLICY",
            "thresholds": {"maxRmse": 0.1, "maxAbsBias": 0.1, "minNse": 0.9},
            "events": [
                self.event("cal", "CALIBRATION", "2026-01-01"),
                self.event("val", "INDEPENDENT_VALIDATION", "2026-02-01"),
            ],
        }

    def event(self, name, role, day):
        obs = self.root / f"{name}-obs.csv"
        model = self.root / f"{name}-model.csv"
        prefix = "\n".join(f"{day}T{i:02d}:00:00Z,{i}" for i in (1, 2, 3))
        obs.write_text("time,stage\n" + prefix + "\n")
        model.write_text("time,stage\n" + prefix + "\n")
        datum = self.root / f"{name}-datum.txt"
        datum.write_text("Synthetic datum receipt for unit tests, not survey evidence\n")
        return {
            "eventId": name,
            "role": role,
            "stationId": "USGS-03378500",
            "units": "ft",
            "observedDatum": "LOCAL_TEST_GAGE",
            "modeledDatum": "LOCAL_TEST_GAGE",
            "datumControlPath": str(datum),
            "datumControlSha256": sha(datum),
            "observedCsv": str(obs),
            "observedSha256": sha(obs),
            "modeledCsv": str(model),
            "modeledSha256": sha(model),
        }

    def test_two_independent_events_with_exact_receipts(self):
        result = module.evaluate(self.policy)
        self.assertEqual(result["assessmentState"], "CANDIDATE_FOR_INDEPENDENT_REVIEW")
        self.assertEqual(result["events"][0]["rmse"], 0)
        self.assertEqual(result["events"][1]["nse"], 1)
        self.assertFalse(result["forecastOperational"])
        self.assertFalse(result["engineeringCertified"])
        self.assertFalse(result["regulatoryApproved"])

    def test_rejects_datum_mismatch_and_tampering(self):
        self.policy["events"][0]["modeledDatum"] = "NAVD88"
        with self.assertRaisesRegex(module.CalibrationError, "DATUM_MISMATCH"):
            module.evaluate(self.policy)
        self.policy["events"][0]["modeledDatum"] = "LOCAL_TEST_GAGE"
        Path(self.policy["events"][0]["observedCsv"]).write_text("time,stage\nchanged\n")
        with self.assertRaisesRegex(module.CalibrationError, "ARTIFACT_SHA256_MISMATCH"):
            module.evaluate(self.policy)

    def test_rejects_event_overlap_and_pseudo_independent_validation(self):
        self.policy["events"][1]["role"] = "CALIBRATION"
        with self.assertRaisesRegex(module.CalibrationError, "SEPARATE_CALIBRATION"):
            module.evaluate(self.policy)
        self.policy["events"][1]["role"] = "INDEPENDENT_VALIDATION"
        self.policy["events"][1]["observedCsv"] = self.policy["events"][0]["observedCsv"]
        self.policy["events"][1]["observedSha256"] = self.policy["events"][0]["observedSha256"]
        self.policy["events"][1]["modeledCsv"] = self.policy["events"][0]["modeledCsv"]
        self.policy["events"][1]["modeledSha256"] = self.policy["events"][0]["modeledSha256"]
        with self.assertRaisesRegex(module.CalibrationError, "EVENTS_ARE_NOT_INDEPENDENT"):
            module.evaluate(self.policy)

    def test_policy_failure_is_not_promoted_to_certified_forecast(self):
        self.policy["thresholds"]["minNse"] = 1
        self.policy["events"][1]["modeledCsv"] = str(self.root / "biased.csv")
        m = Path(self.policy["events"][1]["modeledCsv"])
        m.write_text("time,stage\n2026-02-01T01:00:00Z,0\n2026-02-01T02:00:00Z,0\n2026-02-01T03:00:00Z,0\n")
        self.policy["events"][1]["modeledSha256"] = sha(m)
        result = module.evaluate(self.policy)
        self.assertEqual(result["assessmentState"], "FAILED_USER_DECLARED_POLICY")


if __name__ == "__main__":
    unittest.main()
