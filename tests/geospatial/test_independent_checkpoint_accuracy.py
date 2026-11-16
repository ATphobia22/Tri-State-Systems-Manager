"""Synthetic vectors test formulas; fixtures are NEVER real survey evidence."""
import csv
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
FILE = ROOT / "scripts/geospatial/independent_checkpoint_accuracy.py"
spec = importlib.util.spec_from_file_location("checkpoint", FILE)
accuracy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(accuracy)

HEADER = ("checkpoint_id", "product_x_m", "reference_x_m",
          "product_y_m", "reference_y_m", "product_z_m", "reference_z_m")


def write_csv(path, n=30, mode="3d"):
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=HEADER)
        writer.writeheader()
        for i in range(n):
            writer.writerow({
                "checkpoint_id": f"TEST-{i:02d}",
                "product_x_m": 1000 + i + (-0.2 if i % 2 else 0.2),
                "reference_x_m": 1000 + i,
                "product_y_m": 2000 + i + (-0.2 if i % 2 else 0.2),
                "reference_y_m": 2000 + i,
                "product_z_m": 120 + (0.1 if i % 2 else -0.1),
                "reference_z_m": 120,
            })


class AccuracyTests(unittest.TestCase):
    def test_30_synthetic_samples_fit_only_no_certification(self):
        with tempfile.TemporaryDirectory() as folder:
            csv_path = Path(folder) / "test-fixture.csv"
            write_csv(csv_path)
            rows = accuracy.load_checkpoints(csv_path, "3d")
            result = accuracy.calculate(rows, "3d", accuracy.evidence(None, csv_path, "3d"))
            self.assertEqual(result["sampleCount"], 30)
            self.assertAlmostEqual(result["metrics"]["rmseX_fit_m"], 0.2)
            self.assertAlmostEqual(result["metrics"]["rmseH1_fit_m"], math.sqrt(0.08))
            self.assertAlmostEqual(result["metrics"]["rmseV1_fit_m"], 0.1)
            self.assertIsNone(result["metrics"]["rmseV_final_with_declared_survey_error_m"])
            self.assertEqual(result["classification"], "COMPUTED_UNCERTIFIED")
            self.assertFalse(result["standards"]["ASPRS_2024_ED2_V2"]["formalComplianceClaim"])

    def test_under_30_is_explicitly_insufficient_for_asprs(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "small.csv"
            write_csv(path, n=20)
            r = accuracy.calculate(accuracy.load_checkpoints(path, "vertical"), "vertical",
                                   accuracy.evidence(None, path, "vertical"))
            self.assertFalse(r["standards"]["ASPRS_2024_ED2_V2"]["minimumCountCriterionMet"])
            self.assertTrue(r["standards"]["FGDC_NSSDA_1998"]["countCriterionMet"])
            self.assertIsNone(r["standards"]["FGDC_NSSDA_1998"]["vertical95_m"])

    def test_adjusted_asprs_rmse_uses_actual_hash_checked_survey_rmse(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = root / "synthetic.csv"
            write_csv(path)
            report = root / "test-survey-report.txt"
            report.write_text("SYNTHETIC TEST FIXTURE — NO REAL SURVEY\n")
            source = root / "test-derived-dataset.bin"
            source.write_bytes(b"synthetic only")
            manifest = {
                "schema": "tsm-independent-checkpoint-input-v1",
                "datasetId": "TEST_FIXTURE_NOT_REAL",
                "checkpointCsvSha256": accuracy.file_sha256(path),
                "sourceDatasetPath": source.name, "sourceDatasetSha256": accuracy.file_sha256(source),
                "surveyReportPath": report.name, "surveyReportSha256": accuracy.file_sha256(report),
                "horizontalCrs": "EPSG:26916", "verticalDatum": "NAVD88", "coordinatesUnits": "m",
                "checkpointIndependenceDeclared": True,
                "representativeCoverageDeclared": True,
                "sameCoordinateFrameDeclared": True,
                "coordinateOperationEvidence": "SYNTHETIC_FIXTURE_NOT_REAL_PROJECTION",
                "surveyMethod": "SYNTHETIC_TEST",
                "surveyRMSE_H2_m": 0.03, "surveyRMSE_V2_m": 0.04,
                "systematicErrorsReviewed": True,
                "normalIndependentErrorAssumptionsReviewed": True
            }
            mpath = root / "manifest.json"
            mpath.write_text(json.dumps(manifest))
            p = accuracy.evidence(mpath, path, "3d")
            result = accuracy.calculate(accuracy.load_checkpoints(path, "3d"), "3d", p)
            self.assertAlmostEqual(result["metrics"]["rmseH_final_with_declared_survey_error_m"],
                                   math.sqrt(0.08 + 0.03 ** 2))
            self.assertAlmostEqual(result["metrics"]["rmseV_final_with_declared_survey_error_m"],
                                   math.sqrt(0.01 + 0.04 ** 2))
            self.assertAlmostEqual(result["standards"]["FGDC_NSSDA_1998"]["vertical95_m"], 0.196)
            self.assertTrue(p["sourceDataHashVerified"])
            self.assertTrue(p["surveyReportHashVerified"])
            self.assertFalse(p["coordinateFrameVerifiedBySoftware"])
            self.assertFalse(result["standards"]["ASPRS_2024_ED2_V2"]["formalComplianceClaim"])

    def test_mismatched_checkpoint_digest_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = root / "source.csv"
            write_csv(path)
            manifest = root / "p.json"
            manifest.write_text(json.dumps({
                "schema": "tsm-independent-checkpoint-input-v1",
                "horizontalCrs": "EPSG:26916", "coordinatesUnits": "m",
                "verticalDatum": "NAVD88",
                "checkpointCsvSha256": "a" * 64
            }))
            with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
                accuracy.evidence(manifest, path, "vertical")

    def test_missing_survey_report_cannot_adjust_final_rmse(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = root / "source.csv"
            write_csv(path)
            manifest = root / "p.json"
            manifest.write_text(json.dumps({
                "schema": "tsm-independent-checkpoint-input-v1",
                "horizontalCrs": "EPSG:26916", "coordinatesUnits": "m",
                "verticalDatum": "NAVD88",
                "checkpointCsvSha256": accuracy.file_sha256(path),
                "surveyRMSE_V2_m": 0.02
            }))
            with self.assertRaisesRegex(ValueError, "requires a local hash-verified survey report"):
                accuracy.evidence(manifest, path, "vertical")

    def test_duplicate_checkpoint_id_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "dupe.csv"
            write_csv(path, n=2)
            lines = path.read_text().splitlines()
            lines[-1] = lines[-2]
            path.write_text("\n".join(lines) + "\n")
            with self.assertRaisesRegex(ValueError, "duplicate"):
                accuracy.load_checkpoints(path, "vertical")

    def test_nan_is_rejected_not_skipped(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "bad.csv"
            write_csv(path, n=2)
            raw = path.read_text().replace("120.1", "nan")
            path.write_text(raw)
            with self.assertRaisesRegex(ValueError, "finite"):
                accuracy.load_checkpoints(path, "vertical")

    def test_legacy_anisotropy_prevents_invalid_95_estimate(self):
        rows = [{"checkpoint_id": str(i), "product_x_m": 2., "reference_x_m": 0.,
                 "product_y_m": .01, "reference_y_m": 0.} for i in range(30)]
        prov = {"normalIndependentErrorAssumptionsReviewed": True, "systematicErrorsReviewed": True}
        result = accuracy.calculate(rows, "horizontal", prov)
        self.assertIsNone(result["standards"]["FGDC_NSSDA_1998"]["horizontal95_m"])
        self.assertEqual(result["standards"]["FGDC_NSSDA_1998"]["horizontalLimitation"],
                         "RMSE_MIN_OVER_MAX_BELOW_0_6")

    def test_missing_vertical_columns_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "missing.csv"
            path.write_text("checkpoint_id,product_x_m,reference_x_m\nA,1,1\n")
            with self.assertRaisesRegex(ValueError, "Missing checkpoint columns"):
                accuracy.load_checkpoints(path, "vertical")


if __name__ == "__main__":
    unittest.main()
