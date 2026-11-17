#!/usr/bin/env python3
"""Offline contract tests for the triad's shared traceability envelope."""
from __future__ import annotations

from pathlib import Path
import json
import tempfile
import unittest

from scripts.innovation import civic_evidence_bundle as combine
from scripts.public_interest import evidence_kit as kit
from scripts.public_interest import evidence_packet_export as export


class CivicBundleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.geo = self.root / "geo.json"
        self.contracts = self.root / "contracts.json"
        self.geo.write_text(json.dumps({
            "schema": "tsm.geotruth.building-qa.v1",
            "publishedSha256": "0" * 64,
            "publishedPinMatchesActualBytes": True,
            "expectedArchivedSourceFeatureCount": 3,
            "publishedFeatureCount": 2,
            "expectedMinusPublishedCount": 1,
            "identityCoverageStatus": "PINNED_ARCHIVED_DELTA",
        }))
        self.contracts.write_text(json.dumps({
            "schema": "tsm.government.contract-foundry.v1",
            "catalogSha256": "1" * 64,
            "catalogSourceCount": 2,
            "contractChecksMissingCount": 5,
            "planeImpact": {"impacted_planes": [{
                "plane_id": "terrain", "relationship_evidence": "DECLARED_ONLY"}]},
        }))

    def test_missing_passport_kept_unevidenced(self):
        report = combine.bundle(self.geo, self.contracts)
        self.assertEqual(report["passport"]["status"], "NOT_EVIDENCED")
        self.assertIn("PASSPORT_EXPORT_NOT_SUPPLIED", report["reviewRequired"])
        self.assertEqual(report["governmentContracts"]["missingMetadataReviewCount"], 5)
        self.assertFalse(report["geospatialAlignmentIndependentlyVerified"])
        self.assertFalse(report["windowsOfflineShippingVerified"])
        self.assertEqual(report["governmentContracts"]["dataPlaneImpacts"][0]["plane_id"], "terrain")

    def _passport(self):
        doc = kit.passport({"snapshotId": "SYNTHETIC", "sources": []}, {
            "schema": "tsm.public-evidence.parcel-input.v1",
            "parcelId": "SYNTHETIC-001", "countyFips": "18129",
            "facts": [],
        }, "2026-11-17T12:00:00Z")
        path = self.root / "passport.json"
        path.write_text(json.dumps(doc), encoding="utf-8")
        loaded, digest = export.load_passport(path)
        export.export(loaded, digest, self.root / "passport-export")
        return path, self.root / "passport-export.receipt.json"

    def test_real_export_file_digests_are_verified(self):
        passport, receipt = self._passport()
        report = combine.bundle(self.geo, self.contracts,
                                passport_path=passport, receipt_path=receipt)
        self.assertEqual(report["passport"]["status"], "LOCAL_EXPORT_BYTES_MATCH_RECEIPT_ONLY")
        self.assertEqual(report["passport"]["parcelId"], "SYNTHETIC-001")
        self.assertEqual(set(report["passport"]["outputs"]), {"docx", "xlsx"})
        self.assertFalse(report["passport"]["parcelGeometryJoinVerified"])

    def test_tampering_in_exported_docx_is_detected(self):
        passport, receipt = self._passport()
        with (self.root / "passport-export.docx").open("ab") as stream:
            stream.write(b"tamper")
        with self.assertRaisesRegex(ValueError, "Document hash mismatch"):
            combine.bundle(self.geo, self.contracts,
                           passport_path=passport, receipt_path=receipt)

    def test_cannot_replace_input_with_bundle_output(self):
        with self.assertRaises(SystemExit) as ctx:
            combine.main([
                "--geotruth", str(self.geo),
                "--contracts", str(self.contracts),
                "--output", str(self.geo),
            ])
        self.assertEqual(ctx.exception.code, 2)

    def test_unknown_schema_rejected(self):
        self.geo.write_text(json.dumps({"schema": "wrong",
                                        "expectedMinusPublishedCount": 1}))
        with self.assertRaisesRegex(ValueError, "Unexpected evidence schema"):
            combine.bundle(self.geo, self.contracts)

    def test_rejects_duplicate_json_properties(self):
        self.contracts.write_text('{"schema":"tsm.government.contract-foundry.v1","schema":"evil"}')
        with self.assertRaisesRegex(ValueError, "Duplicate JSON property"):
            combine.bundle(self.geo, self.contracts)


if __name__ == "__main__":
    unittest.main()
