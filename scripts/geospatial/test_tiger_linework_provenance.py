"""Exercise the offline reader with the archived 2026 Posey release."""
from pathlib import Path
import shutil
from tempfile import TemporaryDirectory
import unittest

from compile_tri_state_offline_layers import read_tiger


ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = (ROOT / "data-sources/downloads/posey-18129/census-2026/18129"
           / "roads/tl_2026_18129_roads.zip")


class TigerLineworkProvenanceTests(unittest.TestCase):
    def test_2026_source_rows_keep_their_year_and_identity(self):
        roads = read_tiger(ARCHIVE, "18129", "roads")
        self.assertEqual(len(roads), 2817)
        self.assertEqual(len({road["id"] for road in roads}), len(roads))
        self.assertEqual({road["properties"]["source_vintage"] for road in roads}, {"2026"})
        self.assertTrue(all(road["id"].startswith("TIGER2026:18129:roads:") for road in roads))

    def test_source_archive_must_match_the_requested_layer_and_its_members(self):
        with self.assertRaisesRegex(ValueError, "requested county and layer"):
            read_tiger(ARCHIVE, "18129", "linearwater")

        with TemporaryDirectory() as directory:
            misnamed = Path(directory) / "tl_2024_18129_roads.zip"
            shutil.copyfile(ARCHIVE, misnamed)
            with self.assertRaisesRegex(ValueError, "member does not match archive"):
                read_tiger(misnamed, "18129", "roads")
