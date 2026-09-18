import unittest

from backend.api.v1.live_fabric import _source_timestamp


class LiveFabricTests(unittest.TestCase):
    def test_source_timestamp_is_preserved(self) -> None:
        self.assertEqual(
            _source_timestamp({"validTime": "2026-09-18T12:00:00Z"}),
            "2026-09-18T12:00:00Z",
        )

    def test_missing_timestamp_is_explicit(self) -> None:
        self.assertIsNone(_source_timestamp({"value": 12.3}))


if __name__ == "__main__":
    unittest.main()
