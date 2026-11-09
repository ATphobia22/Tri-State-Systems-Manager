"""Pure local 23,082-identity staging tests with synthetic geometry; no agency data."""
from __future__ import annotations
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/geospatial"))
from stage_posey_screening_inventory import stage  # noqa: E402


def feature(number: int, county: str = "Posey") -> dict:
    return {
        "type": "Feature",
        "properties": {"sourceObjectId": number, "county": county, "height": 12},
        "geometry": {"type": "Polygon",
                     "coordinates": [[[-87.9, 37.9], [-87.899, 37.9],
                                       [-87.899, 37.899], [-87.9, 37.9]]]},
    }


class ScreeningStageTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.pub = self.root / "published.json"
        self.src = self.root / "source.json"
        self.live = self.root / "live.json"
        self.delta = self.root / "delta.json"
        self.out = self.root / "staged.json"

        def write_fc(path, features):
            path.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
            return hashlib.sha256(path.read_bytes()).hexdigest()
        pub_hash = write_fc(self.pub, [feature(x) for x in range(1, 22816)])
        src_hash = write_fc(self.src, [feature(x) for x in range(1, 23083)])
        live_hash = write_fc(self.live, [feature(x) for x in range(22816, 23083)])
        Path(str(self.live) + ".provenance.json").write_text(json.dumps({
            "sha256": live_hash, "retrievedLiveCandidates": 267,
            "notReturnedFromLiveService": [],
            "sourceItemId": "384f2d5041a14c34bd9e807c568784da",
            "validationStatus": "UNVERIFIED",
        }))
        self.delta.write_text(json.dumps({
            "publishedAssetSha256": pub_hash,
            "sourceAssetSha256": src_hash,
            "missingArchivedSourceObjectIds": list(range(22816, 23083)),
        }))

    def test_screening_inventory_has_exact_identity_count_without_height_promotion(self):
        report = stage(self.pub, self.src, self.live, self.delta, self.out)
        self.assertEqual(report["staged2dIdentityCount"], 23082)
        self.assertTrue(report["identitySetMatchesArchived"])
        self.assertFalse(report["engineeringAccepted"])
        self.assertFalse(report["regulatoryApproved"])
        self.assertFalse(report["threeDTilesRebuilt"])
        self.assertEqual(report["heightDerivationCountForRecovered"], 0)
        records = json.loads(self.out.read_text())["features"]
        self.assertEqual(records[-1]["properties"]["sourceObjectId"], 23082)
        self.assertNotIn("height", records[-1]["properties"])
        self.assertEqual(records[-1]["properties"]["tsmHeightStatus"], "NOT_EVIDENCED")

    def test_tampered_published_file_rejected(self):
        self.pub.write_bytes(self.pub.read_bytes() + b" ")
        with self.assertRaisesRegex(ValueError, "HASH_MISMATCH"):
            stage(self.pub, self.src, self.live, self.delta, self.out)


if __name__ == "__main__":
    unittest.main()
