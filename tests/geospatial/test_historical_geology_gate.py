"""Synthetic-only tests: bibliographic records never establish parcel geological evidence."""
import copy
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("historical_geology_gate", ROOT / "scripts/geospatial/historical_geology_gate.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
CATALOG = json.loads((ROOT / mod.CATALOG).read_text(encoding="utf-8"))
BOARDS = json.loads((ROOT / mod.AUTHORITY_INDEX).read_text(encoding="utf-8"))

class HistoricalGeologyTests(unittest.TestCase):
    def test_official_catalog_checked_not_approved(self):
        result = mod.verify_catalog(CATALOG)
        self.assertEqual(result["publicationCount"], 6)
        self.assertFalse(result["siteSurveyEvidence"])
        self.assertIsNone(result["geologicMapSchemaConformant"])
    def test_1970_vincennes_boundary_requires_real_spatial_footprint(self):
        r = next(x for x in CATALOG["publications"] if x["id"] == "IGWS-RGM03-1970")
        self.assertEqual(r["poseyCoverageStatus"], "FOOTPRINT_NOT_GEOREFERENCED")
        self.assertFalse(r["georeferencedFootprintVerified"])
    def test_no_historical_publication_can_certify_site(self):
        for usage in ("BIBLIOGRAPHY", "REGIONAL_CONTEXT", "SITE_ENGINEERING", "REGULATORY"):
            result = mod.evaluate_request(CATALOG, "IGWS-MM48-1987", usage)
            self.assertFalse(result["siteEngineeringEvidenceAccepted"])
            self.assertFalse(result["regulatoryEvidenceAccepted"])
            self.assertFalse(result["mapPixelsRedistributionApproved"])
    def test_duplicate_identity_refused(self):
        m = copy.deepcopy(CATALOG)
        m["publications"].append(copy.deepcopy(m["publications"][0]))
        with self.assertRaisesRegex(ValueError, "repeated"):
            mod.verify_catalog(m)
    def test_fabricated_site_observation_refused(self):
        m = copy.deepcopy(CATALOG)
        m["publications"][0]["siteGeotechnicalObservation"] = True
        with self.assertRaisesRegex(ValueError, "siteGeotechnicalObservation"):
            mod.verify_catalog(m)
    def test_unauthorised_map_redistribution_refused(self):
        m = copy.deepcopy(CATALOG)
        m["publications"][1]["publicMapRedistributionApproved"] = True
        with self.assertRaisesRegex(ValueError, "publicMapRedistributionApproved"):
            mod.verify_catalog(m)
    def test_fake_file_checksum_refused(self):
        m = copy.deepcopy(CATALOG)
        m["publications"][0]["sourceArtifactSha256"] = "a" * 64
        with self.assertRaisesRegex(ValueError, "no map bytes"):
            mod.verify_catalog(m)
    def test_non_catalog_url_refused(self):
        m = copy.deepcopy(CATALOG)
        m["publications"][0]["catalogUrl"] = "https://example.com/fake"
        with self.assertRaisesRegex(ValueError, "non-official"):
            mod.verify_catalog(m)
    def test_scale_denominator_must_be_integral(self):
        m = copy.deepcopy(CATALOG)
        m["publications"][1]["mapScaleDenominator"] = 500000.2
        with self.assertRaisesRegex(ValueError, "map scale"):
            mod.verify_catalog(m)
    def test_unknown_publication_refused(self):
        with self.assertRaisesRegex(ValueError, "Unknown"):
            mod.evaluate_request(CATALOG, "NONEXISTENT", "REGIONAL_CONTEXT")


class StateAuthorityTests(unittest.TestCase):
    def test_state_directories_separate_board_from_exam_provider(self):
        r = mod.verify_licensing_authorities(BOARDS)
        self.assertEqual(r["stateBoardsListed"], 3)
        self.assertFalse(r["licenseCredentialsVerified"])
    def test_asbog_cannot_become_issuer(self):
        b = copy.deepcopy(BOARDS)
        b["asbog"]["issuesLicenses"] = True
        with self.assertRaisesRegex(ValueError, "ASBOG"): mod.verify_licensing_authorities(b)
    def test_cannot_claim_live_license_verification(self):
        b = copy.deepcopy(BOARDS)
        b["authorities"][1]["liveLicenseVerified"] = True
        with self.assertRaisesRegex(ValueError, "cannot self-issue"): mod.verify_licensing_authorities(b)
    def test_board_url_authority_must_match_state(self):
        b = copy.deepcopy(BOARDS)
        b["authorities"][2]["boardReference"] = b["authorities"][1]["boardReference"]
        with self.assertRaisesRegex(ValueError, "boardReference"): mod.verify_licensing_authorities(b)

if __name__ == "__main__":
    unittest.main()
