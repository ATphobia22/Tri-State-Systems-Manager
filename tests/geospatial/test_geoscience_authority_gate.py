"""Synthetic, offline checks for geoscience source and review-document gates."""
import copy
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "geoscience_authority_gate", ROOT / "scripts/geospatial/geoscience_authority_gate.py"
)
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)

REFERENCE_ONLY = {
    "schema": "tsm-geoscience-evidence-v1",
    "subjectType": "GEOLOGIC_MAP",
    "evidenceLevel": "CATALOG_ONLY",
    "jurisdiction": "MULTI_STATE",
    "interpretive": False,
    "automatedApproval": False,
    "reviewEvidence": [],
    "source": {
        "id": "SYNTHETIC-MAP", "issuer": "TEST ONLY",
        "standardId": "USGS-GEMS-2020", "standardEdition": "2020",
        "sourceUri": "https://example.org/no-actual-geologic-data",
        "coverage": "Fixture only", "horizontalCrs": "UNKNOWN",
        "verticalDatum": "UNKNOWN", "units": "UNKNOWN",
        "limitations": "Not a real geologic map; not a GeMS validation",
    },
}


class GeoscienceAuthorityGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.refs = gate.check_registry(ROOT)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.manifest = copy.deepcopy(REFERENCE_ONLY)

    def pin(self, name: str, content: bytes = b"SYNTHETIC TEST DATA"):
        path = self.root / name
        path.write_bytes(content)
        return {"localPath": name, "sha256": hashlib.sha256(content).hexdigest()}

    def hashed_source(self):
        self.manifest["evidenceLevel"] = "SOURCE_BYTES_HASHED"
        self.manifest["source"].update({
            "retrievedAtUtc": "2026-11-16T02:00:00Z",
            "sourceArtifact": self.pin("fixture.bin"),
        })

    def reviews(self, interpretive=False):
        self.hashed_source()
        self.manifest["evidenceLevel"] = "REVIEW_DOCUMENTS_PRESENT"
        self.manifest["interpretive"] = interpretive
        items = [
            ("DATA_REVIEW", "researcher-one"),
            ("METADATA_REVIEW", "researcher-two"),
        ] + ([("SCIENTIFIC_PEER_REVIEW", "peer-A"), ("SCIENTIFIC_PEER_REVIEW", "peer-B")] if interpretive else [])
        self.manifest["reviewEvidence"] = [
            {"kind": kind, "reviewerRef": reviewer, "reviewedAtUtc": "2026-11-16T02:30:00Z",
             "artifact": self.pin(f"review-{i}.txt", f"FICTIONAL REVIEW {i}".encode())}
            for i, (kind, reviewer) in enumerate(items)
        ]

    def test_registry_is_officially_scoped_not_universal_licensing(self):
        self.assertGreaterEqual(len(self.refs), 14)
        self.assertEqual(self.refs["FGDC-NGAC-ADVISORY"]["role"], "ADVISORY_ONLY")
        self.assertEqual(self.refs["ASBOG-EXAM"]["role"], "EXAM_PROVIDER")
        self.assertEqual(self.refs["AIPG-CPG"]["role"], "VOLUNTARY_CERTIFICATION")
        self.assertEqual(self.refs["IN-LPG-BOARD"]["role"], "STATE_LICENSE_AUTHORITY")
        self.assertEqual(self.refs["USGS-3DEP-LBS-2025A"]["edition"], "2025 rev. A")
        self.assertEqual(self.refs["USGS-GEMS-2020"]["edition"], "2020")

    def test_catalog_only_never_claims_source_acquisition_or_geology_accuracy(self):
        result = gate.check_manifest(self.manifest, self.root, self.refs)
        self.assertEqual(result["status"], "DISCOVERY_REFERENCE_ONLY")
        self.assertFalse(result["sourceBytesVerified"])
        self.assertFalse(result["schemaConformanceEstablished"])
        self.assertIsNone(result["scientificCertification"])

    def test_hashed_source_is_only_byte_verified(self):
        self.hashed_source()
        result = gate.check_manifest(self.manifest, self.root, self.refs)
        self.assertEqual(result["status"], "SOURCE_BYTES_HASHED_NOT_SCIENCE_VALIDATED")
        self.assertTrue(result["sourceBytesVerified"])
        self.assertFalse(result["usgsBureauApproved"])
        self.assertFalse(result["regulatoryApproval"])

    def test_actual_checksum_mismatch_is_rejected(self):
        self.hashed_source()
        (self.root / "fixture.bin").write_bytes(b"corrupted")
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            gate.check_manifest(self.manifest, self.root, self.refs)

    def test_actual_file_must_be_under_project_root(self):
        self.hashed_source()
        self.manifest["source"]["sourceArtifact"]["localPath"] = "../outside.bin"
        with self.assertRaisesRegex(ValueError, "escaped repository"):
            gate.check_manifest(self.manifest, self.root, self.refs)

    def test_absolute_path_and_symlink_are_rejected(self):
        self.hashed_source()
        original = self.manifest["source"]["sourceArtifact"].copy()
        self.manifest["source"]["sourceArtifact"]["localPath"] = str(self.root / "fixture.bin")
        with self.assertRaisesRegex(ValueError, "relative path"):
            gate.check_manifest(self.manifest, self.root, self.refs)
        try:
            (self.root / "link.bin").symlink_to(self.root / "fixture.bin")
        except (OSError, NotImplementedError):
            return
        self.manifest["source"]["sourceArtifact"] = {**original, "localPath": "link.bin"}
        with self.assertRaisesRegex(ValueError, "symlink"):
            gate.check_manifest(self.manifest, self.root, self.refs)

    def test_legacy_collection_edition_is_retained_not_rewritten(self):
        self.hashed_source()
        self.manifest["source"]["standardEdition"] = "historical edition: needs provenance"
        result = gate.check_manifest(self.manifest, self.root, self.refs)
        self.assertFalse(result["editionMatchesReference"])
        self.assertEqual(result["documentedSourceEdition"], "historical edition: needs provenance")

    def test_two_distinct_peer_reviewers_documented_not_certified(self):
        self.reviews(interpretive=True)
        result = gate.check_manifest(self.manifest, self.root, self.refs)
        self.assertEqual(result["status"], "REVIEW_DOCUMENTS_HASHED_NOT_AUTHENTICATED")
        self.assertEqual(len(result["hashedReviews"]), 4)
        self.assertFalse(result["professionalLicenseVerified"])
        self.assertFalse(result["schemaConformanceEstablished"])

    def test_interpretive_output_without_two_peers_rejected(self):
        self.reviews(interpretive=True)
        self.manifest["reviewEvidence"].pop()
        with self.assertRaisesRegex(ValueError, "two separately documented reviewers"):
            gate.check_manifest(self.manifest, self.root, self.refs)

    def test_data_and_metadata_review_missing_not_claimed_complete(self):
        self.reviews()
        self.manifest["reviewEvidence"] = self.manifest["reviewEvidence"][:1]
        with self.assertRaisesRegex(ValueError, "data and metadata review"):
            gate.check_manifest(self.manifest, self.root, self.refs)

    def test_self_declared_geologic_conformance_and_professional_approval_rejected(self):
        for name in ("gemsConformant", "professionalLicenseVerified", "regulatoryApproval",
                     "usgsBureauApproved", "lidarSpecificationCertified"):
            sample = copy.deepcopy(self.manifest)
            sample[name] = True
            with self.subTest(claim=name), self.assertRaisesRegex(ValueError, "self-certification prohibited"):
                gate.check_manifest(sample, self.root, self.refs)

    def test_advisory_and_licensing_roles_do_not_become_map_specifications(self):
        for authority in ("FGDC-NGAC-ADVISORY", "IN-LPG-BOARD", "ASBOG-EXAM"):
            sample = copy.deepcopy(self.manifest)
            sample["source"]["standardId"] = authority
            with self.subTest(authority=authority), self.assertRaisesRegex(ValueError, "inapplicable standard role"):
                gate.check_manifest(sample, self.root, self.refs)

    def test_elevation_source_requires_explicit_crs_and_vertical_datums(self):
        self.manifest["subjectType"] = "LIDAR_COLLECTION"
        self.manifest["source"]["standardId"] = "USGS-3DEP-LBS-2025A"
        self.manifest["source"]["standardEdition"] = "2025 rev. A"
        result = gate.check_manifest(self.manifest, self.root, self.refs)
        self.assertFalse(result["sourceBytesVerified"])
        self.manifest["source"]["horizontalCrs"] = "EPSG:2966"
        self.manifest["source"]["units"] = "ftUS"
        self.assertEqual(gate.check_manifest(self.manifest, self.root, self.refs)["status"], "DISCOVERY_REFERENCE_ONLY")
        self.manifest["source"]["units"] = "feet maybe"
        with self.assertRaisesRegex(ValueError, "declare m/ftUS"):
            gate.check_manifest(self.manifest, self.root, self.refs)

    def test_review_claim_with_no_actual_review_artifacts_fails(self):
        self.hashed_source()
        self.manifest["evidenceLevel"] = "REVIEW_DOCUMENTS_PRESENT"
        with self.assertRaisesRegex(ValueError, "data and metadata review"):
            gate.check_manifest(self.manifest, self.root, self.refs)

    def test_wrong_schema_and_http_source_are_rejected(self):
        sample = copy.deepcopy(self.manifest)
        sample["schema"] = "not-our-schema"
        with self.assertRaisesRegex(ValueError, "schema mismatch"):
            gate.check_manifest(sample, self.root, self.refs)
        sample = copy.deepcopy(self.manifest)
        sample["source"]["sourceUri"] = "http://example.org/no-tls"
        with self.assertRaisesRegex(ValueError, "HTTPS"):
            gate.check_manifest(sample, self.root, self.refs)


if __name__ == "__main__":
    unittest.main()
