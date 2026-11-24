"""Synthetic presubmittal fixtures; cannot certify or authorize an excavation."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pre_submittal import screen_project


def project():
    return {
        "schemaVersion": "tsm.pre-submittal-screen.v1",
        "projectId": "synthetic-posey-berm",
        "jurisdiction": "IN",
        "workType": "earthwork",
        "floodway": {"intersects": "unknown"},
        "usaceLevee": {"intersects": "unknown"},
    }


class ReviewScreenTests(unittest.TestCase):
    def test_unknown_floodway_and_levee_remain_unresolved(self):
        result = screen_project(project())
        self.assertEqual(result["decision"], "HUMAN_REVIEW_REQUIRED")
        self.assertFalse(result["permitApproved"])
        self.assertFalse(result["engineeringApproved"])
        self.assertIn("FLOODWAY_INTERSECTION_EVIDENCE_REQUIRED", result["blockers"])
        self.assertIn("USACE_LEVEE_INTERSECTION_EVIDENCE_REQUIRED", result["blockers"])
        self.assertIn("IN-FLOODWAY-CAPACITY-0.15FT", result["candidateRules"])
        self.assertNotIn("IL-PART-3700-FLOODWAYS", result["candidateRules"])

    def test_false_operator_assertions_without_receipts_do_not_clear_checks(self):
        p = project()
        p["floodway"] = {"intersects": "no"}
        p["usaceLevee"] = {"intersects": "no"}
        result = screen_project(p)
        self.assertIn("FLOODWAY_INTERSECTION_EVIDENCE_REQUIRED", result["blockers"])
        self.assertIn("USACE_LEVEE_INTERSECTION_EVIDENCE_REQUIRED", result["blockers"])
        self.assertFalse(result["permitApproved"])

    def test_floodway_overlap_flags_hydraulic_review_and_no_legal_determination(self):
        p = project()
        p["floodway"] = {"intersects": "yes", "sourceSha256": "a" * 64}
        p["usaceLevee"] = {"intersects": "yes", "sourceSha256": "b" * 64}
        result = screen_project(p)
        self.assertIn("FEMA_FLOODWAY_ENCROACHMENT_REVIEW_REQUIRED", result["blockers"])
        self.assertIn("USACE_SECTION_408_APPLICABILITY_REVIEW_REQUIRED", result["blockers"])
        self.assertEqual(result["decision"], "HUMAN_REVIEW_REQUIRED")
        self.assertFalse(result["permitApproved"])
        self.assertFalse(result["hydraulicModelValidated"])

    def test_811_protection_routes_jurisdiction_correctly_without_assuming_notice(self):
        expected = {"IN": "Indiana 811", "IL": "JULIE / Illinois 811", "KY": "Kentucky 811"}
        for state, provider in expected.items():
            p = project()
            p["jurisdiction"] = state
            p["workType"] = "utility-excavation"
            result = screen_project(p)
            with self.subTest(state=state):
                self.assertEqual(result["oneCallProvider"], provider)
                self.assertIn("UTILITY_LOCATION_AND_ONE_CALL_REVIEW_REQUIRED", result["blockers"])
                self.assertFalse(result["excavationCleared"])

    def test_rejects_malformed_intersections_and_unknown_jurisdiction(self):
        for change in ("unknown-state", "invalid-hash", "ambiguous", "missing-worktype"):
            p = project()
            if change == "unknown-state":
                p["jurisdiction"] = "OH"
            if change == "invalid-hash":
                p["floodway"] = {"intersects": "yes", "sourceSha256": "not-a-hash"}
            if change == "ambiguous":
                p["floodway"] = {"intersects": True}
            if change == "missing-worktype":
                del p["workType"]
            with self.subTest(change=change), self.assertRaises(ValueError):
                screen_project(p)

    def test_deterministic_receipts_not_measured_or_operator_authority(self):
        p = project()
        one = screen_project(p)
        self.assertEqual(one, screen_project(p))
        p["workType"] = "levee-modification"
        two = screen_project(p)
        self.assertNotEqual(one["screenSha256"], two["screenSha256"])
        self.assertEqual(one["authorityClass"], "DERIVED")
        self.assertEqual(one["sourceVerification"], "RECEIPTS_UNVERIFIED")
        self.assertFalse(one["engineerSealed"])
        self.assertFalse(one["agencyApproved"])


if __name__ == "__main__":
    unittest.main()
