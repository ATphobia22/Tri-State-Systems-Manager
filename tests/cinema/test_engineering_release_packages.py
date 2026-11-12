"""Regression tests for release and human decision boundaries."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]


def load(relative, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


release = load("packages/release-gates/evaluate.py", "tsm_release_gates")
approval = load("packages/approval-workflows/approval.py", "tsm_human_approval")


class GateTests(unittest.TestCase):
    def setUp(self):
        self.data = {"schema": "tsm.release-evidence.v1",
                     "checks": {x: {"state": "NOT_EVIDENCED"}
                                for x in release.REQUIRED}}

    def test_missing_evidence_blocks_release(self):
        x = release.evaluate(self.data)
        self.assertEqual(x["verdict"], "NOT_RELEASE_READY")
        self.assertEqual(len(x["outstanding"]), len(release.REQUIRED))

    def test_verified_without_real_digest_refused(self):
        self.data["checks"]["native_map"] = {"state": "VERIFIED"}
        with self.assertRaisesRegex(ValueError, "source SHA-256"):
            release.evaluate(self.data)

    def test_complete_records_only_eligible_for_review(self):
        for name in release.REQUIRED:
            self.data["checks"][name] = {
                "state": "VERIFIED",
                "artifact_sha256": "a" * 64,
                "evidence_uri": "file:///TSMData/verified/" + name,
            }
        self.assertEqual(release.evaluate(self.data)["verdict"],
                         "ELIGIBLE_FOR_HUMAN_RELEASE_REVIEW")

    def test_human_approval_never_grants_machine_authority(self):
        data = {
            "schema": "tsm.human-approval.v1",
            "scope": "CINEMATIC_PUBLICATION",
            "artifact_sha256": "b" * 64,
            "decision": "APPROVED",
            "reviewed_source_evidence_sha256": "a" * 64,
            "reviewer": {
                "identity_verification_evidence_uri": "file:///reviews/identity.json",
                "human_asserted_at": "2026-11-12T16:00:00Z",
                "authorization_scope": "CINEMATIC_PUBLICATION"
            }
        }
        answer = approval.inspect_approval(data)
        self.assertFalse(answer["may_auto_publish"])
        self.assertEqual(answer["authorization"], "UNVERIFIED_EXTERNAL_REVIEW_REQUIRED")
        data["reviewer"]["identity_verification_evidence_uri"] = ""
        with self.assertRaises(ValueError):
            approval.inspect_approval(data)


if __name__ == "__main__":
    unittest.main()
