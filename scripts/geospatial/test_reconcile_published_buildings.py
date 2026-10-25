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

    def test_expected_count_must_be_positive(self):
        with tempfile.TemporaryDirectory() as tmp:
            pub = write_fc(Path(tmp) / "published.json", [1])
            with self.assertRaisesRegex(ValueError, "positive"):
                reconcile(pub, None, expected_count=0)


if __name__ == "__main__":
    unittest.main()
