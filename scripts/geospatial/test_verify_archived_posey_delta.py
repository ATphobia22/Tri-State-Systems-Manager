"""Fixture tests for the archived Posey identity evidence gate."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from verify_archived_posey_delta import verify_delta  # noqa: E402


def fc(path, ids):
    features = [
        {"type": "Feature", "properties": {"igioObjectId": i},
         "geometry": {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}}
        for i in ids
    ]
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf8")
    return path


class ArchivedDeltaTests(unittest.TestCase):
    def fixture(self, root):
        src = fc(root / "source.geojson", [10, 11, 12, 13])
        pub = fc(root / "public.geojson", [10, 12, 13])
        h = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
        pin = {
            "schemaVersion": "tsm.posey.archived-igio-building-id-delta.v1",
            "sourceFeatureCount": 4, "publishedFeatureCount": 3,
            "sourceAssetSha256": h(src), "publishedAssetSha256": h(pub),
            "missingArchivedSourceObjectIds": [11], "extraPublishedObjectIds": [],
            "idDifferenceCount": 1, "sourceDuplicateIdCount": 0,
            "publishedDuplicateIdCount": 0, "sourceInvalidFeatureCount": 0,
            "publishedInvalidFeatureCount": 0,
        }
        expected = root / "pin.json"
        expected.write_text(json.dumps(pin), encoding="utf8")
        return src, pub, expected

    def test_recompute_exact_identity_manifest_with_unverified_remediation(self):
        with tempfile.TemporaryDirectory() as tmp:
            src, pub, pin = self.fixture(Path(tmp))
            report = verify_delta(pub, src, pin)
            self.assertEqual(report["missingCount"], 1)
            self.assertEqual(report["missingBuildings"][0]["sourceObjectId"], 11)
            self.assertEqual(report["missingBuildings"][0]["rootCause"], "UNDETERMINED")
            self.assertFalse(report["missingBuildings"][0]["heightEvidenceVerified"])
            self.assertFalse(report["engineeringUse"])
            self.assertFalse(report["sourceLineageIndependentlyVerified"])

    def test_refuse_stale_source_or_publication_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            src, pub, pin = self.fixture(Path(tmp))
            pub.write_text(pub.read_text() + "\n")
            with self.assertRaisesRegex(ValueError, "published asset SHA-256"):
                verify_delta(pub, src, pin)

    def test_refuse_manifest_missing_identity_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            src, pub, pin = self.fixture(Path(tmp))
            d = json.loads(pin.read_text())
            d["missingArchivedSourceObjectIds"] = [99]
            pin.write_text(json.dumps(d))
            with self.assertRaisesRegex(ValueError, "missing ID set"):
                verify_delta(pub, src, pin)


if __name__ == "__main__":
    unittest.main()
