"""Adversarial tests: scientific acceptance never comes from a green build alone."""
from __future__ import annotations
import importlib.util
import unittest
from pathlib import Path

p = Path(__file__).with_name("independent_acceptance_gate.py")
spec = importlib.util.spec_from_file_location("independent_acceptance_gate", p)
assert spec and spec.loader
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)
H = "a" * 64
B = "b" * 64


def fixture():
    return {
        "terrain": {
            "sourceSha256": H, "controlSurveySha256": H, "checkpointReportSha256": H,
            "horizontalCrs": "EPSG:2966", "verticalDatum": "NAVD88",
            "geometricDatum": "NAD83(2011)", "geoidModel": "GEOID18",
            "verticalUnits": "m", "sourceQualityLevel": "QL2",
            "controlSurveyProfessional": "independent responsible surveyor",
            "checkpointIndependenceValidated": True,
            "checkpointSpatialRepresentativenessReviewed": True,
            "surveyReportApprovedByQualifiedProfessional": True,
            "predeclaredRmseLimitM": 0.1,
            "independentCheckpoints": [
                {"id": "CP-1", "surveyMethod": "GNSS_CONTROL",
                 "source": "INDEPENDENT_SURVEY", "observationSha256": H,
                 "observedNavd88M": 101.0, "demNavd88M": 101.05},
                {"id": "CP-2", "surveyMethod": "DIFFERENTIAL_LEVELING",
                 "source": "INDEPENDENT_SURVEY", "observationSha256": B,
                 "observedNavd88M": 99.0, "demNavd88M": 98.95},
            ],
        },
        "countyMesh": {
            "meshSourceSha256": H, "terrainSourceSha256": H,
            "seamReportSha256": H, "topologyReportSha256": B,
            "tileCoverageSha256": H, "countyName": "Posey", "countyState": "IN",
            "expectedTileCount": 10, "validatedTileCount": 10,
            "boundaryEdgeChecks": 40, "internalSeamChecks": 16,
            "trueCrackCount": 0, "nonManifoldEdgeCount": 0,
            "invalidGeometryCount": 0, "uncoveredTileCount": 0,
            "predeclaredSeamToleranceM": 0.001,
            "maximumMeasuredSeamGapM": 0.0005,
            "allNeighborPairsChecked": True,
            "boundaryClosureValidated": True,
            "geometryValidatorPassed": True,
        },
        "regulatory": {
            "approvedBaseModelSha256": H, "proposedModelSha256": B,
            "hydraulicOutputSha256": H, "engineerReviewSha256": H,
            "modelDatum": "NAVD88", "hydraulicModelStatus": "EXECUTED_AND_CALIBRATED",
            "humanEngineerReviewed": True,
            "localFloodplainAdministratorReviewed": True,
            "basis": "FEMA_NO_RISE", "maximumFloodElevationIncreaseFt": 0.0,
            "automaticPermitOrCertification": False,
        },
    }


class EngineeringPrecheckTests(unittest.TestCase):
    def test_empty_packet_is_incomplete(self):
        r = gate.checks({})
        self.assertEqual(r["overallStatus"], "INCOMPLETE")
        self.assertFalse(r["mayClaimSurveyGradeTerrain"])
        self.assertFalse(r["mayClaimRegulatoryApproval"])
        self.assertFalse(r["mayClaimCountyWideCrackFree"])

    def test_synthetic_complete_packet_never_grants_approval(self):
        r = gate.checks(fixture())
        self.assertEqual(r["overallStatus"], "VERIFIED_PRECHECK")
        self.assertFalse(r["mayClaimSurveyGradeTerrain"])
        self.assertFalse(r["mayClaimRegulatoryApproval"])
        self.assertTrue(r["reviewRequired"])
        self.assertAlmostEqual(fixture()["terrain"]["predeclaredRmseLimitM"], 0.1)

    def test_independent_checkpoints_are_required(self):
        x = fixture()
        x["terrain"]["independentCheckpoints"] = []
        self.assertEqual(gate.checks(x)["sections"]["terrain"]["status"], "INCOMPLETE")

    def test_rmse_exceedance_rejects_precheck(self):
        x = fixture()
        x["terrain"]["independentCheckpoints"][0]["demNavd88M"] = 101.8
        result = gate.checks(x)
        self.assertTrue(any("RMSEz" in e for e in result["sections"]["terrain"]["errors"]))

    def test_bad_geoid_and_datum_metadata_rejected(self):
        x = fixture()
        x["terrain"]["geometricDatum"] = "WGS84"
        self.assertEqual(gate.checks(x)["sections"]["terrain"]["status"], "INCOMPLETE")
        x["terrain"]["geoidModel"] = "EGM2008"
        self.assertEqual(gate.checks(x)["overallStatus"], "INCOMPLETE")

    def test_missing_county_tiles_rejected(self):
        x = fixture()
        x["countyMesh"]["validatedTileCount"] = 9
        self.assertEqual(gate.checks(x)["sections"]["countyMesh"]["status"], "INCOMPLETE")

    def test_true_crack_is_not_masked_by_tolerance(self):
        x = fixture()
        x["countyMesh"]["trueCrackCount"] = 1
        self.assertEqual(gate.checks(x)["sections"]["countyMesh"]["status"], "INCOMPLETE")

    def test_different_terrain_source_hash_is_rejected(self):
        x = fixture()
        x["countyMesh"]["terrainSourceSha256"] = B
        self.assertEqual(gate.checks(x)["sections"]["countyMesh"]["status"], "INCOMPLETE")

    def test_fema_no_rise_does_not_accept_positive_increase(self):
        x = fixture()
        x["regulatory"]["maximumFloodElevationIncreaseFt"] = 0.001
        self.assertEqual(gate.checks(x)["sections"]["regulatory"]["status"], "INCOMPLETE")

    def test_indiana_rule_is_distinct_and_requires_exception_review(self):
        x = fixture()
        x["regulatory"]["basis"] = "INDIANA_FLOODWAY"
        x["regulatory"]["maximumFloodElevationIncreaseFt"] = 0.14
        self.assertEqual(gate.checks(x)["sections"]["regulatory"]["status"], "INCOMPLETE")
        x["regulatory"]["indianaExceptionsReviewed"] = True
        self.assertEqual(gate.checks(x)["sections"]["regulatory"]["status"], "VERIFIED_PRECHECK")
        x["regulatory"]["maximumFloodElevationIncreaseFt"] = 0.15
        self.assertEqual(gate.checks(x)["sections"]["regulatory"]["status"], "INCOMPLETE")

    def test_auto_certification_disallowed(self):
        x = fixture()
        x["regulatory"]["automaticPermitOrCertification"] = True
        self.assertEqual(gate.checks(x)["overallStatus"], "INCOMPLETE")

    def test_null_and_nonfinite_numbers_rejected(self):
        x = fixture()
        x["regulatory"]["maximumFloodElevationIncreaseFt"] = None
        x["countyMesh"]["maximumMeasuredSeamGapM"] = float("nan")
        x["terrain"]["independentCheckpoints"][0]["observedNavd88M"] = float("inf")
        y = gate.checks(x)
        self.assertEqual(y["overallStatus"], "INCOMPLETE")
        self.assertTrue(all(q["errors"] for q in y["sections"].values()))


if __name__ == "__main__":
    unittest.main()
