"""Synthetic authority packets require Merkle integrity, but NEVER confer approval."""
from __future__ import annotations
import copy
import hashlib
import tempfile
import unittest
from pathlib import Path

from backend.merkle_evidence import build_manifest
from backend.regulatory_authority_boundary import evaluate_authority_packet


class AuthorityBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.document = self.root / "fake-decision.txt"
        self.document.write_text("SYNTHETIC TEST ONLY: not a government decision")
        for name in ("source.json", "input.json", "output.json", "validation.json"):
            (self.root / name).write_text("SYNTHETIC " + name)
        def digest(name):
            return hashlib.sha256((self.root / name).read_bytes()).hexdigest()
        self.packet = {
            "schemaVersion": "tsm.authority-packet.v1",
            "claimId": "synthetic-001", "purpose": "Flood hazard screening",
            "areaOfInterest": "Posey County, Indiana",
            "sources": [{
                "sourceId": "fema.nfhl", "agency": "FEMA",
                "uri": "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer",
                "sha256": digest("source.json"), "retrievedAt": "2026-11-09T00:00:00Z",
                "classification": "OBSERVED", "horizontalCrs": "EPSG:2966",
                "verticalDatum": "NAVD88", "units": "ftUS", "uncertainty": 0.5,
            }],
            "technicalEvidence": {
                "method": "synthetic known-answer", "methodVersion": "0",
                "inputManifestSha256": digest("input.json"),
                "outputManifestSha256": digest("output.json"),
                "validationReportSha256": digest("validation.json"),
                "checks": {k: "VERIFIED" for k in
                           ("datum", "uncertainty", "reproducibility", "massBalance", "benchmark", "humanReview")},
            },
            "evidenceBindings": {
                "sources": {"fema.nfhl": "source.json"},
                "inputManifest": "input.json",
                "outputManifest": "output.json",
                "validationReport": "validation.json",
            },
        }

    def merkle_manifest(self, include_decision=False):
        artifacts = [
            ("source", "source.json"), ("technical_input", "input.json"),
            ("technical_output", "output.json"),
            ("technical_validation", "validation.json"),
        ]
        if include_decision:
            artifacts.append(("agency_decision", "fake-decision.txt"))
        return build_manifest(self.root, artifacts)

    def evaluate(self, packet):
        manifest = self.merkle_manifest("agencyDecision" in packet)
        packet["evidenceMerkleRootSha256"] = manifest["merkleRootSha256"]
        return evaluate_authority_packet(packet, evidence_root=self.root,
                                         evidence_manifest=manifest)

    def test_technical_checks_cannot_grant_approval(self):
        result = self.evaluate(self.packet)
        self.assertTrue(result["technicalChecksDeclaredPassed"])
        self.assertFalse(result["technicalEvidenceIndependentlyReproduced"])
        self.assertFalse(result["regulatoryApprovalEstablished"])
        self.assertTrue(result["merkleEvidenceVerified"])
        self.assertEqual(result["status"], "NO_AGENCY_DECISION_EVIDENCED")

    def test_missing_merkle_proof_rejected(self):
        with self.assertRaisesRegex(ValueError, "MERKLE_EVIDENCE_REQUIRED"):
            evaluate_authority_packet(self.packet)

    def test_self_approval_forbidden(self):
        packet = copy.deepcopy(self.packet)
        packet["approvedForRegulatoryUse"] = True
        with self.assertRaisesRegex(ValueError, "SELF_ASSERTED"):
            self.evaluate(packet)

    def test_document_hash_not_equivalent_to_agency_authentication(self):
        packet = copy.deepcopy(self.packet)
        packet["agencyDecision"] = {
            "decisionType": "FEMA_LOMR", "issuer": "FEMA", "caseId": "FAKE-CASE",
            "scope": "synthetic test only", "signer": "not a real signer",
            "jurisdiction": "Posey County, Indiana",
            "officialRegistryUri": "https://msc.fema.gov/portal/search",
            "issuedAt": "2026-11-09T00:00:00Z",
            "effectiveAt": "2026-11-09T00:00:00Z",
            "document": {"path": str(self.document),
                         "sha256": hashlib.sha256(self.document.read_bytes()).hexdigest()},
        }
        packet["evidenceBindings"]["agencyDecision"] = "fake-decision.txt"
        result = self.evaluate(packet)
        self.assertTrue(result["decisionDocumentDigestVerified"])
        self.assertTrue(result["merkleEvidenceVerified"])
        self.assertFalse(result["agencyDecisionIndependentlyAuthenticated"])
        self.assertFalse(result["regulatoryApprovalEstablished"])
        self.document.write_text("tampered")
        with self.assertRaisesRegex(ValueError, "ARTIFACT_TAMPERED"):
            self.evaluate(packet)

    def test_scenario_never_regulatory_source(self):
        packet = copy.deepcopy(self.packet)
        packet["sources"][0]["classification"] = "SCENARIO"
        packet["sources"][0]["regulatorySource"] = True
        with self.assertRaisesRegex(ValueError, "SCENARIO_CANNOT"):
            self.evaluate(packet)

    def test_uncertainty_nonfinite_and_naive_date_rejected(self):
        packet = copy.deepcopy(self.packet)
        packet["sources"][0]["uncertainty"] = float("nan")
        with self.assertRaisesRegex(ValueError, "UNCERTAINTY"):
            self.evaluate(packet)
        packet = copy.deepcopy(self.packet)
        packet["sources"][0]["retrievedAt"] = "2026-11-09T00:00:00"
        with self.assertRaisesRegex(ValueError, "TIMEZONE"):
            self.evaluate(packet)

    def test_source_without_https_rejected(self):
        packet = copy.deepcopy(self.packet)
        packet["sources"][0]["uri"] = "http://example.com"
        with self.assertRaisesRegex(ValueError, "HTTPS"):
            self.evaluate(packet)

    def test_missing_validation_checks_rejected(self):
        packet = copy.deepcopy(self.packet)
        del packet["technicalEvidence"]["checks"]["benchmark"]
        with self.assertRaisesRegex(ValueError, "GATES_INCOMPLETE"):
            self.evaluate(packet)

    def test_wrong_source_merkle_binding_rejected(self):
        packet = copy.deepcopy(self.packet)
        packet["sources"][0]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "SOURCE_MERKLE_DIGEST_MISMATCH"):
            self.evaluate(packet)

    def test_wrong_root_or_manipulated_evidence_rejected(self):
        packet = copy.deepcopy(self.packet)
        packet["evidenceMerkleRootSha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "MERKLE_ROOT_MISMATCH"):
            evaluate_authority_packet(packet, evidence_root=self.root,
                                      evidence_manifest=self.merkle_manifest())
        packet = copy.deepcopy(self.packet)
        manifest = self.merkle_manifest()
        packet["evidenceMerkleRootSha256"] = manifest["merkleRootSha256"]
        (self.root / "source.json").write_text("tampered")
        with self.assertRaisesRegex(ValueError, "MERKLE_EVIDENCE_INVALID"):
            evaluate_authority_packet(packet, evidence_root=self.root,
                                      evidence_manifest=manifest)


if __name__ == "__main__":
    unittest.main()
