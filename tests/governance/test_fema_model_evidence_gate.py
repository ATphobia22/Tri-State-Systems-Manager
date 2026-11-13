import importlib.util
import unittest
from pathlib import Path

SCRIPT=Path(__file__).resolve().parents[2]/"scripts/governance/fema_model_evidence_gate.py"
spec=importlib.util.spec_from_file_location("fema_claim_gate",SCRIPT)
gate=importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class TestFemaClaimGate(unittest.TestCase):
    def test_public_information_never_regulatory(self):
        result=gate.evaluate({"requestedUse":"PUBLIC_INFORMATION",
                              "softwareRole":"PREPOST_PROCESSING","runType":"NONE"})
        self.assertEqual(result["reviewReadiness"],"INFORMATIONAL_ONLY")
        self.assertFalse(result["regulatoryApproved"])

    def test_numerical_model_without_source_evidence_is_blocked(self):
        result=gate.evaluate({"requestedUse":"NFIP_REGULATORY",
                              "softwareRole":"NUMERICAL_MODEL",
                              "runType":"UNSTEADY_2D"})
        self.assertEqual(result["reviewReadiness"],"BLOCKED_FOR_REGULATORY_USE")
        self.assertIn("verticalDatum=NAVD88",result["missingEvidence"])
        self.assertIn("acceptedModelEvidence.acceptanceDocumentSha256",
                      result["missingEvidence"])
        self.assertFalse(result["legacyCheckRasScopeCompatible"])

    def test_complete_asserted_evidence_still_requires_human_review(self):
        hashvalue="a"*64
        result=gate.evaluate({
            "requestedUse":"NFIP_REGULATORY","softwareRole":"NUMERICAL_MODEL",
            "runType":"UNSTEADY_2D","modelName":"HEC-RAS","modelVersion":"6.6",
            "terrainSha256":hashvalue,"inputSha256":hashvalue,"outputSha256":hashvalue,
            "horizontalCrs":"EPSG:2966","verticalDatum":"NAVD88",
            "acceptedModelEvidence":{
                "agency":"Agency claimed by receipt","acceptedModelVersion":"6.6",
                "jurisdiction":"Posey","acceptanceReference":"external signed document",
                "acceptanceDocumentSha256":hashvalue,
            },
            "effectiveStudyReference":"local effective study number",
            "licensedProfessionalReviewReference":"review signature claimed by record",
        })
        self.assertEqual(result["reviewReadiness"],"READY_FOR_HUMAN_AGENCY_REVIEW")
        self.assertFalse(result["regulatoryApproved"])
        self.assertFalse(result["agencyAcceptanceIndependentlyVerified"])

    def test_check_ras_legacy_compatibility_has_strict_scope(self):
        basic={"requestedUse":"PUBLIC_INFORMATION","softwareRole":"NUMERICAL_MODEL",
               "runType":"STEADY_1D","modelName":"HEC-RAS","modelVersion":"4.1.0"}
        result=gate.evaluate(basic)
        self.assertTrue(result["legacyCheckRasScopeCompatible"])
        self.assertFalse(result["legacyCheckRasTestsPerformed"])
        for changes in ({"modelVersion":"6.6"},{"runType":"UNSTEADY_1D"},
                        {"runType":"UNSTEADY_2D"}):
            self.assertFalse(gate.evaluate({**basic,**changes})["legacyCheckRasScopeCompatible"])

    def test_category_one_cannot_claim_executed_regulatory_model(self):
        with self.assertRaises(ValueError):
            gate.evaluate({"requestedUse":"PUBLIC_INFORMATION",
                           "softwareRole":"PREPOST_PROCESSING","runType":"UNSTEADY_2D"})
        outcome=gate.evaluate({"requestedUse":"NFIP_REGULATORY",
                              "softwareRole":"PREPOST_PROCESSING","runType":"NONE"})
        self.assertIn("model must be numerical for a regulatory analysis",outcome["missingEvidence"])
        self.assertFalse(outcome["regulatoryApproved"])

    def test_unrecognized_claims_are_not_accepted(self):
        with self.assertRaises(ValueError):
            gate.evaluate({"requestedUse":"CERTIFIED","softwareRole":"NUMERICAL_MODEL","runType":"STEADY_1D"})

if __name__=="__main__":
    unittest.main()
