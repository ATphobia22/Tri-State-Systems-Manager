"""Fresh-source, per-building accounting tests; synthetic IDs never imply real coverage."""
from __future__ import annotations
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_posey_building_dispositions import account


def make_source(root: Path, ids: list[int]):
    src = root / "igio.geojson"
    features = [{"type": "Feature", "properties": {"objectid": i, "county": "Posey"},
                 "geometry": {"type": "Polygon",
                              "coordinates": [[[0, 0], [0, 1], [1, 1], [0, 0]]]}}
                for i in ids]
    src.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    return src, hashlib.sha256(src.read_bytes()).hexdigest()


def record(oid: int):
    return {"source_objectid": oid, "reconstruction_status": "INSUFFICIENT_LIDAR",
            "uncertainty": {"horizontal_m": None, "vertical_m": None,
                            "reason": "ground and roof surveys unavailable"},
            "review_status": "PENDING", "reviewer": None}


def write(root: Path, source_sha: str, rows: list):
    path = root / "accounts.json"
    path.write_text(json.dumps({"source_sha256": source_sha, "records": rows}))
    return path


def receipt(root: Path, source_sha: str, count: int):
    path = root / "source-receipt.json"
    path.write_text(json.dumps({
        "schema_version": "tsm.indiana-posey-source-inventory.v1",
        "source": "https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0",
        "source_filter": "county='Posey'", "source_identity_complete": True,
        "geometry_download_complete": True, "official_feature_count": count,
        "source_last_edit_epoch_ms": 123456789, "snapshot":
        {"sha256": source_sha, "identity_complete": True}}))
    return path


class PoseyDispositionsTests(unittest.TestCase):
    def test_source_count_is_not_historical_and_unknown_heights_are_accounted(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src, digest = make_source(root, [19, 88, 900])
            r = account(src, write(root, digest, [record(900), record(19), record(88)]),
                        receipt(root, digest, 3))
            self.assertTrue(r["identityReconciled"])
            self.assertEqual(r["freshAuthoritativeCount"], 3)
            self.assertEqual(r["reconciliationRatio"], 1)
            self.assertFalse(r["full3dProductionAcceptance"])
            self.assertFalse(r["allHumanReviewed"])

    def test_missing_or_extra_records_never_reconcile(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src, digest = make_source(root, [7, 8])
            r = account(src, write(root, digest, [record(7), record(11)]),
                        receipt(root, digest, 2))
            self.assertFalse(r["identityReconciled"])
            self.assertEqual(r["missingSourceObjectIds"], [8])
            self.assertEqual(r["nonAuthoritativeObjectIds"], [11])

    def test_duplicates_do_not_pass_ratio_gate(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src, digest = make_source(root, [7, 8])
            r = account(src, write(root, digest, [record(7), record(7), record(8)]),
                        receipt(root, digest, 2))
            self.assertFalse(r["identityReconciled"])
            self.assertEqual(r["duplicateAccountingObjectIds"], [7])
            self.assertEqual(r["reconciliationRatio"], 1)

    def test_unknown_uncertainty_needs_reason(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src, digest = make_source(root, [1])
            row = record(1)
            row["uncertainty"]["reason"] = ""
            r = account(src, write(root, digest, [row]), receipt(root, digest, 1))
            self.assertFalse(r["identityReconciled"])
            self.assertTrue(any("requires reason" in v for v in r["violations"]))

    def test_receipt_digest_mismatch_holds_identity(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src, digest = make_source(root, [1])
            r = account(src, write(root, digest, [record(1)]),
                        receipt(root, "0" * 64, 1))
            self.assertFalse(r["identityReconciled"])
            self.assertTrue(r["sourceReceiptIssues"])

    def test_claimed_height_without_evidence_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src, digest = make_source(root, [1])
            row = record(1)
            row["reconstruction_status"] = "LOD2_ROOF_RECONSTRUCTED"
            r = account(src, write(root, digest, [row]), receipt(root, digest, 1))
            self.assertFalse(r["identityReconciled"])
            self.assertTrue(any("height status" in v for v in r["violations"]))

    def test_no_official_receipt_cannot_be_authoritative(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src, digest = make_source(root, [1])
            r = account(src, write(root, digest, [record(1)]))
            self.assertFalse(r["identityReconciled"])
            self.assertFalse(r["full3dProductionAcceptance"])


if __name__ == "__main__":
    unittest.main()
