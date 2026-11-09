"""Synthetic claims test the prohibition on self-issued engineering authority."""
from __future__ import annotations

import copy
import hashlib
import tempfile
import unittest
from pathlib import Path

from backend.regulatory_authority_boundary import evaluate_authority_packet


class AuthorityBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.document = Path(self.tmp.name) / "fake-decision.txt"
        self.document.write_text("SYNTHETIC TEST ONLY: not a government decision")
        self.packet = {
            "schemaVersion": "tsm.authority-packet.v1",
            "claimId": "synthetic-001", "purpose": "Flood hazard screening",
            "areaOfInterest": "Posey County, Indiana",
            "sources": [{
                "sourceId": "fema.nfhl", "agency": "FEMA",
                "uri": "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer",
                "sha256": "0" * 64, "retrievedAt": "2026-11-09T00:00:00Z",
                "classification": "OBSERVED", "horizontalCrs": "EPSG:2966",
                "verticalDatum": "NAVD88", "units": "ftUS", "uncertainty": 0.5,
            }],
            "technicalEvidence": {
                "method": "synthetic known-answer", "methodVersion": "0",
                "inputManifestSha256": "1" * 64,
                "outputManifestSha256": "2" * 64,
                "validationReportSha256": "3" * 64,
                "checks": {k: "VERIFIED" for k in
                           ("datum", "uncertainty", "reproducibility", "massBalance", "benchmark", "humanReview")},
            },
        }

    def test_technical_checks_cannot_grant_approval(self):
        result = evaluate_authority_packet(self.packet)
        self.assertTrue(result["technicalChecksDeclaredPassed"])
        self.assertFalse(result["technicalEvidenceIndependentlyReproduced"])
        self.assertFalse(result["regulatoryApprovalEstablished"])
        self.assertEqual(result["status"], "NO_AGENCY_DECISION_EVIDENCED")

    def test_self_approval_forbidden(self):
        packet = copy.deepcopy(self.packet)
        packet["approvedForRegulatoryUse"] = True
        with self.assertRaisesRegex(ValueError, "SELF_ASSERTED"):
            evaluate_authority_packet(packet)

    def test_document_hash_not_equivalent_to_agency_authentication(self):
        packet = copy.deepcopy(self.packet)
        packet["agencyDecision"] = {
            "decisionType": "FEMA_LOMR", "issuer": "FEMA", "caseId": "FAKE-CASE",
            "scope": "synthetic test only", "signer": "not a real signer",
            "jurisdiction": "Posey County, Indiana",
            "officialRegistryUri": "https://msc.fema.gov/portal/search",
            "issuedAt": "2026-11-09T00:00:00Z",
            "effectiveAt": "2026-11-09T00:00:00Z",
            "document": {"path": str(self.document), "sha256": hashlib.sha256(self.document.read_bytes()).hexdigest()},
        }
        result = evaluate_authority_packet(packet)
        self.assertTrue(result["decisionDocumentDigestVerified"])
        self.assertFalse(result["agencyDecisionIndependentlyAuthenticated"])
        self.assertFalse(result["regulatoryApprovalEstablished"])
        self.document.write_text("tampered")
        with self.assertRaisesRegex(ValueError, "ARTIFACT_TAMPERED"):
            evaluate_authority_packet(packet)

    def test_scenario_never_regulatory_source(self):
        packet = copy.deepcopy(self.packet)
        packet["sources"][0]["classification"] = "SCENARIO"
        packet["sources"][0]["regulatorySource"] = True
        with self.assertRaisesRegex(ValueError, "SCENARIO_CANNOT"):
            evaluate_authority_packet(packet)

    def test_uncertainty_nonfinite_and_naive_date_rejected(self):
        packet = copy.deepcopy(self.packet)
        packet["sources"][0]["uncertainty"] = float("nan")
        with self.assertRaisesRegex(ValueError, "UNCERTAINTY"):
            evaluate_authority_packet(packet)
        packet = copy.deepcopy(self.packet)
        packet["sources"][0]["retrievedAt"] = "2026-11-09T00:00:00"
        with self.assertRaisesRegex(ValueError, "TIMEZONE"):
            evaluate_authority_packet(packet)

    def test_source_without_https_rejected(self):
        packet = copy.deepcopy(self.packet)
        packet["sources"][0]["uri"] = "http://example.com"
        with self.assertRaisesRegex(ValueError, "HTTPS"):
            evaluate_authority_packet(packet)

    def test_missing_validation_checks_rejected(self):
        packet = copy.deepcopy(self.packet)
        del packet["technicalEvidence"]["checks"]["benchmark"]
        with self.assertRaisesRegex(ValueError, "GATES_INCOMPLETE"):
            evaluate_authority_packet(packet)


if __name__ == "__main__":
    unittest.main()
