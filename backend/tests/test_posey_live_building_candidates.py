from __future__ import annotations
import json
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/geospatial"))
from recover_posey_missing_building_candidates import recover_missing_ids  # noqa: E402


class PoseyOfficialCandidateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.delta = self.root / "delta.json"
        self.delta.write_text(json.dumps({
            "status": "RECONCILIATION_INCOMPLETE",
            "sourceFeatureCount": 23082,
            "idDifferenceCount": 3,
            "missingArchivedSourceObjectIds": [100, 101, 102],
            "sourceAssetSha256": "0" * 64,
        }))
        self.out = self.root / "candidates.geojson"

    def test_only_returns_verified_posey_candidates_not_approval(self):
        def fetch(url: str) -> bytes:
            ids = [int(x) for x in parse_qs(urlsplit(url).query)["objectIds"][0].split(",")]
            self.assertEqual(ids, [100, 101, 102])
            return json.dumps({"type": "FeatureCollection", "features": [
                {"type": "Feature", "properties": {"objectid": 100, "county": "Posey", "lidaryear": "2019"},
                 "geometry": {"type": "Polygon", "coordinates": [[[-88, 38], [-87.9, 38], [-87.9, 37.9], [-88, 38]]]}}
            ]}).encode()

        report = recover_missing_ids(self.delta, self.out, fetch)
        self.assertEqual(report["retrievedLiveCandidates"], 1)
        self.assertEqual(report["notReturnedFromLiveService"], [101, 102])
        self.assertFalse(report["engineeringUse"])
        self.assertFalse(report["regulatoryUse"])
        self.assertEqual(report["validationStatus"], "UNVERIFIED")
        self.assertTrue(Path(str(self.out) + ".provenance.json").is_file())

    def test_wrong_county_is_rejected(self):
        def fetch(url: str) -> bytes:
            return json.dumps({"type": "FeatureCollection", "features": [
                {"type": "Feature", "properties": {"objectid": 100, "county": "Gibson"},
                 "geometry": {"type": "Polygon", "coordinates": []}},
            ]}).encode()
        with self.assertRaisesRegex(ValueError, "COUNTY_NOT_POSEY"):
            recover_missing_ids(self.delta, self.out, fetch)

    def test_unknown_objectid_is_rejected(self):
        def fetch(url: str) -> bytes:
            return json.dumps({"type": "FeatureCollection", "features": [
                {"type": "Feature", "properties": {"objectid": 999, "county": "Posey"},
                 "geometry": {"type": "Polygon", "coordinates": []}},
            ]}).encode()
        with self.assertRaisesRegex(ValueError, "OBJECTID_UNREQUESTED"):
            recover_missing_ids(self.delta, self.out, fetch)

    def test_duplicate_ids_in_delta_rejected(self):
        info = json.loads(self.delta.read_text())
        info["missingArchivedSourceObjectIds"] = [100, 100, 101]
        self.delta.write_text(json.dumps(info))
        with self.assertRaisesRegex(ValueError, "DELTA_INVALID"):
            recover_missing_ids(self.delta, self.out, lambda _: b"")
