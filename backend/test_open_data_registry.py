import unittest

from backend.open_data_registry import (
    INDIANA_ELEVATION_REGISTRY_BLOB_SHA,
    OPEN_DATA_REGISTRY_COMMIT,
    INDIANA_ELEVATION_REGISTRY_PATH,
    indiana_elevation_registry_entry,
    verify_registry_snapshot,
)


class OpenDataRegistryTests(unittest.TestCase):
    def test_indiana_entry_is_immutably_pinned(self) -> None:
        entry = indiana_elevation_registry_entry()
        self.assertEqual(entry.commit, OPEN_DATA_REGISTRY_COMMIT)
        self.assertEqual(entry.path, INDIANA_ELEVATION_REGISTRY_PATH)
        self.assertEqual(entry.blob_sha, INDIANA_ELEVATION_REGISTRY_BLOB_SHA)
        self.assertIn(entry.commit, entry.raw_url)
        self.assertIn(entry.path, entry.raw_url)

    def test_snapshot_hash_is_deterministic(self) -> None:
        self.assertEqual(
            verify_registry_snapshot("Name: Indiana Statewide Elevation Catalog\n"),
            verify_registry_snapshot("Name: Indiana Statewide Elevation Catalog\n"),
        )

    def test_empty_snapshot_fails_closed(self) -> None:
        with self.assertRaises(ValueError):
            verify_registry_snapshot("")


if __name__ == "__main__":
    unittest.main()
