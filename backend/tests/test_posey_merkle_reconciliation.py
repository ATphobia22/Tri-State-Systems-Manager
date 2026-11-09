"""Synthetic archived source proves identity reconciliation is distinct from certification."""
from __future__ import annotations
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from scripts.geospatial.verify_posey_candidate_reconciliation import verify_posey_2d_candidates


def geometry(i):
    return {"type": "Polygon", "coordinates": [[
        [i, 0], [i + .5, 0], [i + .5, .5], [i, .5], [i, 0]
    ]]}


class PoseyMerkleReconciliationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.full = [
            {"type": "Feature", "properties": {"OBJECTID": i, "lidaryear": 2019},
             "geometry": geometry(i)} for i in range(1, 5)
        ]
        self.pub = [
            {"type": "Feature", "properties": {"igioObjectId": i, "heightM": 5.0},
             "geometry": geometry(i)} for i in (1, 2)
        ]
        self.candidates = [
            {"type": "Feature", "properties": {"objectid": i, "county": "Posey", "lidaryear": 2019},
             "geometry": geometry(i)} for i in (3, 4)
        ]
        self.write_fc("source.json", self.full)
        self.write_fc("published.json", self.pub)
        self.write_fc("candidates.json", self.candidates)
        self.make_delta()

    def write_fc(self, name, features):
        (self.root / name).write_text(json.dumps({"type": "FeatureCollection", "features": features}))

    def digest(self, name):
        return hashlib.sha256((self.root / name).read_bytes()).hexdigest()

    def make_delta(self):
        (self.root / "delta.json").write_text(json.dumps({
            "sourceFeatureCount": 4, "sourceAssetSha256": self.digest("source.json"),
            "publishedAssetSha256": self.digest("published.json"),
            "missingArchivedSourceObjectIds": [3, 4], "idDifferenceCount": 2,
        }))

    def evaluate(self):
        return verify_posey_2d_candidates(
            self.root, source="source.json", published="published.json",
            candidates="candidates.json", delta="delta.json", expected_count=4)

    def test_all_objectids_returned_not_regulatory_and_missing_heights(self):
        result = self.evaluate()
        self.assertTrue(result["candidateIdentitySetComplete"])
        self.assertEqual(result["restored2dCandidateCount"], 4)
        self.assertTrue(result["archivedVerifiedByHash"])
        self.assertEqual(result["identicalSerializedGeometryCount"], 2)
        self.assertEqual(result["candidateHeightNotEvidencedIds"], [3, 4])
        self.assertFalse(result["full3dEngineeringAcceptance"])
        self.assertFalse(result["regulatoryUse"])
        self.assertEqual(len(result["merkleRootSha256"]), 64)

    def test_geometry_change_flagged_without_auto_promoting(self):
        self.candidates[0]["geometry"] = geometry(30)
        self.write_fc("candidates.json", self.candidates)
        result = self.evaluate()
        self.assertEqual(result["nonidenticalSerializedGeometryIds"], [3])
        self.assertFalse(result["candidateGeometryStringEquivalent"])

    def test_changed_archived_file_rejected(self):
        self.full[0]["properties"]["OBJECTID"] = 987
        self.write_fc("source.json", self.full)
        with self.assertRaisesRegex(ValueError, "HASH_NOT_PINNED"):
            self.evaluate()

    def test_unrequested_object_id_denied(self):
        self.candidates[0]["properties"]["objectid"] = 999
        self.write_fc("candidates.json", self.candidates)
        with self.assertRaisesRegex(ValueError, "UNREQUESTED_IDS"):
            self.evaluate()

    def test_missing_candidate_is_not_complete(self):
        self.candidates.pop()
        self.write_fc("candidates.json", self.candidates)
        result = self.evaluate()
        self.assertFalse(result["candidateIdentitySetComplete"])
        self.assertEqual(result["missingCandidateIds"], [4])

    def test_archive_delta_requires_exact_ids(self):
        self.make_delta()
        path = self.root / "delta.json"
        delta = json.loads(path.read_text())
        delta["missingArchivedSourceObjectIds"] = [2, 3]
        path.write_text(json.dumps(delta))
        with self.assertRaisesRegex(ValueError, "DELTA_DOES_NOT_MATCH"):
            self.evaluate()

    def test_missing_source_is_failure_not_synthetic_fill(self):
        (self.root / "source.json").unlink()
        with self.assertRaisesRegex(ValueError, "NOT_REGULAR"):
            self.evaluate()


if __name__ == "__main__":
    unittest.main()
