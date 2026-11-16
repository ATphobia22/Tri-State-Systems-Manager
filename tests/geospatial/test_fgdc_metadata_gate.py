"""Bounded checks; sample metadata is not asserted to be authoritative source data."""
import copy
import importlib.util
import hashlib
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATH = ROOT / "scripts/geospatial/fgdc_metadata_gate.py"
spec = importlib.util.spec_from_file_location("fgdc_metadata_gate", PATH)
fgdc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fgdc)

SAMPLE = {
    "schema": "tsm-geospatial-source-metadata",
    "records": [{
        "datasetId": "test-fixture-only", "name": "Synthetic test metadata", "agency": "TEST",
        "sourceUri": "https://example.org/test-not-actual-data", "sourceVersion": "fixture",
        "horizontalCrs": "EPSG:2966", "verticalDatum": "UNKNOWN", "units": "ftUS",
        "limitations": "Fixture only; not real terrain data", "authorityClass": "REFERENCE",
        "verificationStatus": "DISCOVERY_ONLY", "contentSha256": None,
        "elevationTransformPermitted": False
    }]
}


class FGDCGateTests(unittest.TestCase):
    def test_real_tracked_source_metadata_is_parseable(self):
        self.assertGreaterEqual(fgdc.check_profile(ROOT)["profileStandards"], 8)
        self.assertIn("REGISTERED", fgdc.check_registry(ROOT)["registry"])
        source = fgdc.check_csdgm(ROOT)
        self.assertEqual(source["csdgm"], "PARSED_LEGACY_SOURCE_METADATA_ONLY")
        self.assertEqual(len(source["xmlSha256"]), 64)

    def test_geologic_schema_and_usgs_review_policy_are_references_not_certificates(self):
        import json
        profile = json.loads((ROOT / "data/standards/fgdc-standards-profile-v1.json").read_text())
        indexed = {item["id"]: item for item in profile["standards"]}
        self.assertIn("USGS-GEMS-2020", indexed)
        self.assertIn("USGS-FSP-502.7-2026", indexed)
        self.assertIn("geologic map database", " ".join(indexed["USGS-GEMS-2020"]["use"]))
        self.assertIn("not certification", " ".join(indexed["USGS-FSP-502.7-2026"]["use"]))
        self.assertFalse(profile["policy"]["automaticRegulatoryCertification"])

    def test_discovery_fixture_is_not_evidence(self):
        self.assertEqual(fgdc.check_records(SAMPLE)["sourceRecordsChecked"], 1)

    def test_reject_unproven_acquisition(self):
        record = copy.deepcopy(SAMPLE)
        record["records"][0]["verificationStatus"] = "SOURCE_CHECKSUM_VERIFIED"
        with self.assertRaisesRegex(ValueError, "retrievedAtUtc"):
            fgdc.check_records(record)

    def test_unknown_vertical_datum_blocks_transform(self):
        record = copy.deepcopy(SAMPLE)
        record["records"][0]["elevationTransformPermitted"] = True
        with self.assertRaisesRegex(ValueError, "unknown vertical datum"):
            fgdc.check_records(record)

    def test_independent_review_needs_external_evidence(self):
        record = copy.deepcopy(SAMPLE)
        source = ROOT / "data/regulatory/nfhl-indiana-20260706-metadata.xml"
        record["records"][0].update({
            "verificationStatus": "INDEPENDENTLY_REVIEWED",
            "retrievedAtUtc": "2026-11-15T19:00:00Z",
            "contentSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "localPath": "data/regulatory/nfhl-indiana-20260706-metadata.xml",
        })
        with self.assertRaisesRegex(ValueError, "review evidence required"):
            fgdc.check_records(record)

    def test_acquired_local_digest_must_match(self):
        record = copy.deepcopy(SAMPLE)
        record["records"][0].update({
            "verificationStatus": "SOURCE_CHECKSUM_VERIFIED",
            "retrievedAtUtc": "2026-11-15T19:00:00Z",
            "contentSha256": "a" * 64,
            "localPath": "data/regulatory/nfhl-indiana-20260706-metadata.xml",
        })
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            fgdc.check_records(record)

    def test_reject_untrusted_source_url(self):
        record = copy.deepcopy(SAMPLE)
        record["records"][0]["sourceUri"] = "http://example.org/no-tls"
        with self.assertRaisesRegex(ValueError, "HTTPS"):
            fgdc.check_records(record)


if __name__ == "__main__":
    unittest.main()
