import copy
import json
import unittest
from pathlib import Path
from validate_film_shots import validate

PLAN = Path(__file__).resolve().parents[2] / "data/cinematic/film-shot-plan.v1.json"

class ShotPlanTests(unittest.TestCase):
    def setUp(self):
        self.plan = json.loads(PLAN.read_text(encoding="utf-8"))

    def test_six_scenarios(self):
        self.assertEqual(validate(self.plan)["shot_count"], 6)

    def test_duplicate_ids_rejected(self):
        bad = copy.deepcopy(self.plan)
        bad["shots"][1]["id"] = bad["shots"][0]["id"]
        with self.assertRaises(ValueError):
            validate(bad)

    def test_unverified_render_gate_cannot_be_promoted(self):
        bad = copy.deepcopy(self.plan)
        bad["releaseGate"] = "VERIFIED"
        with self.assertRaises(ValueError):
            validate(bad)

    def test_unknown_evidence_rejected(self):
        bad = copy.deepcopy(self.plan)
        bad["shots"][0]["requiredEvidence"].append("fictional-source")
        with self.assertRaises(ValueError):
            validate(bad)

    def test_flood_comparison_with_camera_preview_is_rejected(self):
        bad = copy.deepcopy(self.plan)
        bad["shots"][3]["preview"] = bad["shots"][0]["preview"]
        with self.assertRaisesRegex(ValueError, "flood comparison"):
            validate(bad)

    def test_out_of_range_camera_key_is_rejected(self):
        bad = copy.deepcopy(self.plan)
        bad["shots"][0]["preview"]["keyframes"][-1]["rangeScale"] = 0.1
        with self.assertRaisesRegex(ValueError, "rangeScale"):
            validate(bad)

if __name__ == "__main__":
    unittest.main()
