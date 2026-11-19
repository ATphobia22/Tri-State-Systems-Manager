"""All fixtures are synthetic; no real-world dataset or agency decision is certified."""
import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from backend.evidence.dataset_inventory_gate import preflight


class DatasetInventoryGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "source.bin").write_bytes(b"SYNTHETIC SOURCE")
        (self.root / "ids.json").write_text(json.dumps({
            "schema": "tsm-feature-id-inventory-v1", "datasetId": "synthetic",
            "releaseId": "2026-v1", "countyFips": ["18129"], "featureIds": ["a", "b"]}))
        (self.root / "review.txt").write_text("synthetic, not authenticated")
        def artifact(name):
            data = (self.root / name).read_bytes()
            return {"path": name, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}
        self.packet = {
            "schema": "tsm-dataset-inventory-reconciliation-v1", "intendedUse": "VISUALIZATION",
            "source": {
                "datasetId": "synthetic", "authority": "SYNTHETIC", "serviceLayerId": "test/0",
                "releaseId": "2026-v1", "limitations": "synthetic", "units": "ftUS",
                "sourceUri": "https://example.test/0", "retrievedAtUtc": "2026-11-19T10:00:00Z",
                "publicationAtUtc": "2026-11-18T10:00:00Z", "acquiredAtUtc": "2026-11-17T10:00:00Z",
                "horizontalCrs": "EPSG:2966", "verticalDatum": "NAVD88", "snapshot": artifact("source.bin"),
            },
            "inventory": {
                "expectedCount": 2, "observedCount": 2, "expectedCountyFips": ["18129"],
                "featureIdInventory": artifact("ids.json"),
            },
            "review": {"evidence": artifact("review.txt")},
        }

    def check(self, mutate=None):
        packet = copy.deepcopy(self.packet)
        if mutate is not None:
            mutate(packet)
        return preflight(packet, self.root)

    def test_preview_only_no_automatic_eng_or_regulatory_authority(self):
        result = self.check()
        self.assertEqual(result["status"], "RECONCILED_FOR_PREVIEW")
        self.assertTrue(result["inventoryReconciled"])
        self.assertTrue(result["engineeringReviewReady"])
        self.assertFalse(result["engineeringConsumptionAuthorized"])
        self.assertIsNone(result["regulatoryDetermination"])

    def test_modified_source_bytes_fail(self):
        (self.root / "source.bin").write_bytes(b"tampered")
        self.assertIn("source.snapshot: SHA256_MISMATCH", self.check()["errors"])

    def test_missing_count_not_silently_accepted(self):
        result = self.check(lambda x: x["inventory"].update(observedCount=1))
        self.assertTrue(any("COUNT_MISMATCH" in e for e in result["errors"]))
        self.assertFalse(result["inventoryReconciled"])

    def test_duplicate_ids_and_release_disagreement_fail(self):
        (self.root / "ids.json").write_text(json.dumps({
            "schema": "tsm-feature-id-inventory-v1", "datasetId": "synthetic",
            "releaseId": "wrong", "countyFips": ["18129"], "featureIds": ["a", "a"]}))
        raw = (self.root / "ids.json").read_bytes()
        self.packet["inventory"]["featureIdInventory"].update(
            sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw))
        result = self.check()
        self.assertIn("inventory: DUPLICATE_FEATURE_IDS", result["errors"])
        self.assertIn("inventory: DATASET_OR_RELEASE_MISMATCH", result["errors"])

    def test_unknown_datum_blocks_engineering_review(self):
        result = self.check(lambda x: x["source"].update(verticalDatum="UNKNOWN"))
        self.assertFalse(result["engineeringReviewReady"])

    def test_regulatory_source_needs_independent_lomc_and_bfe(self):
        result = self.check(lambda x: x.update(intendedUse="REGULATORY_SCREENING"))
        self.assertTrue(any("FEMA_LOMC_BFE" in e for e in result["errors"]))
        self.assertFalse(result["engineeringConsumptionAuthorized"])

    def test_path_escape_and_symlink_rejected(self):
        a = self.check(lambda x: x["source"]["snapshot"].update(path="../outside"))
        self.assertTrue(any("UNSAFE_PATH" in e for e in a["errors"]))
        (self.root / "alias").symlink_to(self.root / "source.bin")
        b = self.check(lambda x: x["source"]["snapshot"].update(path="alias"))
        self.assertTrue(any("SYMLINK_FORBIDDEN" in e for e in b["errors"]))

    def test_self_declared_independence_not_sufficient(self):
        result = self.check(lambda x: x["review"].update(sourceIdentityIndependentlyReviewed=True))
        self.assertTrue(any("SELF_ATTESTED" in e for e in result["errors"]))


if __name__ == "__main__":
    unittest.main()
