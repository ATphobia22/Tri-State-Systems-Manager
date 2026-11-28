"""Synthetic, dependency-free tests for the public building identity audit."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from reconcile_published_buildings import reconcile  # noqa: E402


def write_fc(path: Path, ids: list[int | None], *, bad_geometry: bool = False) -> Path:
    features = []
    for source_id in ids:
        props = {} if source_id is None else {"igioObjectId": source_id}
        features.append({
            "type": "Feature",
            "properties": props,
            "geometry": {"type": "Point", "coordinates": [0, 0]} if not bad_geometry else None,
        })
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8")
    return path


class BuildingIdentityAuditTests(unittest.TestCase):
    def test_without_authoritative_file_never_invents_missing_ids(self):
        with tempfile.TemporaryDirectory() as tmp:
            pub = write_fc(Path(tmp) / "published.json", [1, 2])
            result = reconcile(pub, None, expected_count=4)
            self.assertEqual(result["status"], "COUNT_GAP_SOURCE_UNVERIFIED")
            self.assertEqual(result["countGapAgainstExpected"], 2)
            self.assertIsNone(result["missingAuthoritativeObjectIds"])
            self.assertTrue(result["missingIdsAreUnknownWithoutAuthoritativeFile"])
            self.assertFalse(result["identityAndCountReconciled"])
            self.assertFalse(result["fullEngineeringAcceptance"])

    def test_deterministic_source_set_difference(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src = write_fc(root / "igio.json", [4, 1, 2, 3])
            pub = write_fc(root / "screening.json", [2, 4, 7])
            first = reconcile(pub, src, expected_count=4)
            second = reconcile(pub, src, expected_count=4)
            self.assertEqual(first, second)
            self.assertEqual(first["missingAuthoritativeObjectIds"], [1, 3])
            self.assertEqual(first["publishedObjectIdsAbsentFromAuthoritative"], [7])
            self.assertEqual(first["status"], "RECONCILIATION_INCOMPLETE")
            self.assertFalse(first["engineeringUse"])
            self.assertEqual(len(first["published"]["sha256"]), 64)

    def test_count_match_with_unique_ids_is_identity_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src = write_fc(root / "source.json", [1, 2, 3])
            pub = write_fc(root / "published.json", [3, 2, 1])
            result = reconcile(pub, src, expected_count=3)
            self.assertTrue(result["identityAndCountReconciled"])
            self.assertEqual(result["status"], "IDENTITY_MATCH_COUNTS_ONLY")
            self.assertFalse(result["fullEngineeringAcceptance"])
            self.assertEqual(result["missingAuthoritativeObjectIds"], [])

    def test_duplicate_ids_never_qualify_as_complete(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src = write_fc(root / "source.json", [1, 2])
            pub = write_fc(root / "published.json", [1, 1])
            result = reconcile(pub, src, expected_count=2)
            self.assertEqual(result["published"]["duplicateSourceObjectIds"], [1])
            self.assertFalse(result["identityAndCountReconciled"])

    def test_missing_id_not_silently_generated(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src = write_fc(root / "source.json", [1, 2])
            pub = write_fc(root / "published.json", [1, None])
            result = reconcile(pub, src, expected_count=2)
            self.assertEqual(result["published"]["missingIdentityCount"], 1)
            self.assertFalse(result["identityAndCountReconciled"])

    def test_malformed_geojson_fails_with_clear_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "broken.json"
            p.write_text(json.dumps({"features": []}), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "FeatureCollection"):
                reconcile(p, None, expected_count=1)

    def test_conflicting_objectid_aliases_fail_instead_of_selecting_one(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = write_fc(Path(tmp) / "published.json", [1])
            payload = json.loads(path.read_text(encoding="utf-8"))
            payload["features"][0]["properties"]["OBJECTID"] = 2
            path.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "conflicting source OBJECTID aliases"):
                reconcile(path, None, expected_count=1)

    def test_identity_digest_is_order_independent_but_substitution_sensitive(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            first = reconcile(write_fc(root / "a.json", [3, 1, 2]), None, expected_count=3)
            reordered = reconcile(write_fc(root / "b.json", [1, 2, 3]), None, expected_count=3)
            different = reconcile(write_fc(root / "c.json", [1, 2, 4]), None, expected_count=3)
            key = "sortedIdentityMultisetSha256"
            self.assertEqual(first["published"][key], reordered["published"][key])
            self.assertNotEqual(first["published"][key], different["published"][key])
            self.assertEqual(len(first["published"][key]), 64)

    def test_expected_count_must_be_positive(self):
        with tempfile.TemporaryDirectory() as tmp:
            pub = write_fc(Path(tmp) / "published.json", [1])
            with self.assertRaisesRegex(ValueError, "positive"):
                reconcile(pub, None, expected_count=0)


    def test_fresh_source_count_is_derived_not_hardcoded(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src = write_fc(root / "official.json", [9, 11, 42, 81, 111])
            pub = write_fc(root / "accounted.json", [81, 9, 111, 11, 42])
            result = reconcile(pub, src)
            self.assertTrue(result["identityAndCountReconciled"])
            self.assertEqual(result["expectedAuthoritativeFeatureCount"], 5)
            self.assertEqual(result["freshAuthoritativeCountDerivedFromSnapshot"], 5)
            self.assertIsNone(result["historicalExpectedCountOverride"])
            self.assertEqual(result["publishedCoveragePercentAgainstExpected"], 100.0)

    def test_unknown_source_does_not_infer_a_count_or_100_percent(self):
        with tempfile.TemporaryDirectory() as tmp:
            pub = write_fc(Path(tmp) / "unverified.json", [1, 2, 3])
            result = reconcile(pub, None)
            self.assertEqual(result["status"], "AUTHORITATIVE_SOURCE_UNAVAILABLE")
            self.assertIsNone(result["expectedAuthoritativeFeatureCount"])
            self.assertIsNone(result["publishedCoveragePercentAgainstExpected"])
            self.assertIsNone(result["countGapAgainstExpected"])
            self.assertFalse(result["identityAndCountReconciled"])

    def test_equal_counts_cannot_hide_source_id_substitution(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src = write_fc(root / "official.json", [5, 6, 7])
            pub = write_fc(root / "substituted.json", [5, 6, 8])
            result = reconcile(pub, src)
            self.assertFalse(result["identityAndCountReconciled"])
            self.assertEqual(result["missingAuthoritativeObjectIds"], [7])
            self.assertEqual(result["publishedObjectIdsAbsentFromAuthoritative"], [8])

    def test_duplicate_source_ids_prevent_acceptance_without_count_override(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src = write_fc(root / "official.json", [5, 5, 6])
            pub = write_fc(root / "accounted.json", [5, 6])
            result = reconcile(pub, src)
            self.assertFalse(result["identityAndCountReconciled"])
            self.assertEqual(result["authoritative"]["duplicateSourceObjectIds"], [5])


if __name__ == "__main__":
    unittest.main()
