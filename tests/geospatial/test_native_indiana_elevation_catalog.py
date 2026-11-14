"""Acquisition-only source catalog contract for the Windows offline digital twin."""
import json
import unittest
from pathlib import Path

CATALOG=(Path(__file__).resolve().parents[2]
         / "tsm-native/config/authoritative-source-catalog.json")


class CatalogTests(unittest.TestCase):
    def test_offline_policy_for_igio_sources(self):
        data=json.loads(CATALOG.read_text(encoding="utf-8"))
        self.assertFalse(data["policy"]["runtimeNetworkAccess"])
        self.assertTrue(data["policy"]["sourceAcquisitionOutsideRuntime"])
        entries={entry["id"]:entry for entry in data["sources"]}
        footprints=entries["indiana-dem-tile-footprints-2016-2020"]
        archive=entries["indiana-elevation-public-s3-archive"]
        self.assertEqual(
            footprints["endpoint"],
            "https://gisdata.in.gov/server/rest/services/Hosted/Indiana_DEM_Tile_Footprints/FeatureServer/0",
        )
        self.assertEqual(archive["bucket"],"giselevationingov")
        self.assertEqual(archive["region"],"us-east-2")
        self.assertEqual(archive["license"],"CC0")
        self.assertFalse(footprints["runtimeNetworkAllowed"])
        self.assertFalse(archive["runtimeNetworkAllowed"])

    def test_native_catalog_has_unique_source_ids(self):
        entries=json.loads(CATALOG.read_text(encoding="utf-8"))["sources"]
        ids=[entry["id"] for entry in entries]
        self.assertEqual(len(ids),len(set(ids)))


if __name__ == "__main__":
    unittest.main()
