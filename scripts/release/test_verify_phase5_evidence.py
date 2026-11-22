"""Fail-closed regression tests for independent release proof contracts."""
import unittest

from verify_phase5_evidence import building_inventory, replay


class Buildings(unittest.TestCase):
    def test_count_only_never_passes(self):
        result = building_inventory(["1", "2", "3"], ["1"], ["2", "3"], ["1"], expected=3)
        self.assertEqual(result["status"], "BLOCKED")
        self.assertTrue(result["visual_footprint_coverage"])
        self.assertFalse(result["full_3d_id_coverage"])
        self.assertEqual(result["source_without_mesh"], 2)

    def test_full_ids_still_require_independent_review(self):
        result = building_inventory(["1", "2"], ["1", "2"], [], ["1", "2"], expected=2)
        self.assertTrue(result["full_3d_id_coverage"])
        self.assertEqual(result["status"], "IDENTITIES_RECONCILED_REVIEW_REQUIRED")

    def test_duplicates_and_unknown_sources_cannot_pass(self):
        with self.assertRaisesRegex(ValueError, "duplicate"):
            building_inventory(["1", "1"], ["1"], [], ["1"], expected=2)
        result = building_inventory(["1"], ["1", "2"], [], ["1"], expected=1)
        self.assertEqual(result["unknown_mesh_ids"], 1)
        self.assertFalse(result["full_3d_id_coverage"])

    def test_missing_heights_blocks(self):
        result = building_inventory(["1", "2"], ["1", "2"], [], ["1"], expected=2)
        self.assertEqual(result["mesh_without_reviewed_height"], 1)
        self.assertEqual(result["status"], "BLOCKED")


class Replays(unittest.TestCase):
    def fixture(self):
        return {"watermark": 7, "next": None,
                "entries": [{"seq": 7, "geometry": None, "event": {
                    "event_id": "test", "matrix": "T", "entity_id": "terrain:test",
                    "source": {"sha256": "c" * 64}}}]}

    def test_replay_digest_matches_order_independently(self):
        doc = self.fixture()
        report = replay(doc, doc)
        self.assertTrue(report["matched"])
        self.assertEqual(report["before_sha256"], report["after_sha256"])

    def test_replay_catches_changed_event(self):
        a = self.fixture()
        b = self.fixture()
        b["entries"][0]["event"]["source"]["sha256"] = "b" * 64
        self.assertFalse(replay(a, b)["matched"])

    def test_watermark_or_incomplete_page_invalidates_receipt(self):
        a, b = self.fixture(), self.fixture()
        b["watermark"] = 8
        with self.assertRaisesRegex(ValueError, "watermark"):
            replay(a, b)
        a["next"] = {"after_id": "foo"}
        with self.assertRaisesRegex(ValueError, "paginated"):
            replay(a, self.fixture())


if __name__ == "__main__":
    unittest.main()
