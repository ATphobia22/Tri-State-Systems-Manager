"""Synthetic fixture tests. Not a survey, geotechnical analysis or flood model."""
import copy
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from earthwork_scenario import evaluate_scenario


def request():
    return {
        "schemaVersion": "tsm.earthwork-scenario.v1",
        "scenarioId": "posey-demo-001",
        "asOf": "2026-11-24T15:00:00Z",
        "baseline": {
            "elevationsM": [[100.0, 100.0], [100.0, 100.0]],
            "cellSizeM": 2.0,
            "originEastingM": 500000.0,
            "originNorthingM": 4200000.0,
            "crs": "EPSG:26916",
            "verticalDatum": "NAVD88",
            "sourceSha256": "a" * 64,
        },
        "edits": [
            {"row": 0, "col": 0, "deltaM": 1.0,
             "validFrom": "2026-11-20T00:00:00Z", "type": "FILL"},
            {"row": 1, "col": 1, "deltaM": -0.5,
             "validFrom": "2026-11-22T00:00:00Z", "type": "CUT"},
        ],
    }


class EarthworkScenarioTests(unittest.TestCase):
    def test_immutable_baseline_and_correct_mixed_cut_fill(self):
        original = request()
        saved = copy.deepcopy(original)
        result = evaluate_scenario(original)
        self.assertEqual(original, saved, "evaluating a scenario must never mutate the baseline")
        self.assertEqual(result["proposedGridM"], [[101.0, 100.0], [100.0, 99.5]])
        self.assertEqual(result["volumesM3"], {"cut": 2.0, "fill": 4.0, "netFill": 2.0})
        self.assertEqual(result["state"], "SIMULATED")
        self.assertFalse(result["engineeringValidated"])
        self.assertFalse(result["published"])
        self.assertIn("SFINCS_OR_HEC_RAS_NOT_EXECUTED", result["blockingGates"])

    def test_historical_as_of_excludes_future_phases(self):
        item = request()
        item["asOf"] = "2026-11-21T00:00:00+00:00"
        result = evaluate_scenario(item)
        self.assertEqual(result["volumesM3"]["fill"], 4.0)
        self.assertEqual(result["volumesM3"]["cut"], 0.0)
        self.assertEqual(result["proposedGridM"][1][1], 100.0)
        self.assertEqual(result["activeEdits"], 1)

    def test_hashes_are_content_addressed_and_change_with_inputs(self):
        item = request()
        one = evaluate_scenario(item)
        self.assertEqual(one["scenarioSha256"], evaluate_scenario(item)["scenarioSha256"])
        item["edits"][0]["deltaM"] = 2.0
        two = evaluate_scenario(item)
        self.assertNotEqual(one["scenarioSha256"], two["scenarioSha256"])
        self.assertNotEqual(one["proposedGridSha256"], two["proposedGridSha256"])

    def test_rejects_unreconciled_coordinate_and_vertical_reference(self):
        for key, value in (("crs", "EPSG:2966"), ("verticalDatum", "NGVD29")):
            item = request()
            item["baseline"][key] = value
            with self.assertRaisesRegex(ValueError, "EPSG:26916|NAVD88"):
                evaluate_scenario(item)

    def test_rejects_bad_dimensions_nodata_and_conflicting_operations(self):
        for modification in ("ragged", "nan", "outside", "wrong-sign", "missing-sha"):
            item = request()
            if modification == "ragged":
                item["baseline"]["elevationsM"][1] = [100.0]
            elif modification == "nan":
                item["baseline"]["elevationsM"][0][0] = float("nan")
            elif modification == "outside":
                item["edits"][0]["col"] = 20
            elif modification == "wrong-sign":
                item["edits"][0]["deltaM"] = -1.0
            elif modification == "missing-sha":
                item["baseline"]["sourceSha256"] = ""
            with self.subTest(modification=modification), self.assertRaises(ValueError):
                evaluate_scenario(item)

    def test_slope_flags_are_diagnostic_only_not_a_permit_or_certificate(self):
        item = request()
        item["edits"][0]["deltaM"] = 3.0
        result = evaluate_scenario(item)
        self.assertGreater(result["maxNeighborGrade"], 1.0/3.0)
        self.assertTrue(result["requiresSlopeReview"])
        self.assertEqual(result["governanceStatus"], "human_review_required")
        self.assertFalse(result["engineeringValidated"])


if __name__ == "__main__":
    unittest.main()
