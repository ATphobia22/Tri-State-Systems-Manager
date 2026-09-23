import unittest

from backend.countygismaps_posey import (
    POSEY_COUNTY_GISMAPS_URL,
    POSEY_COUNTY_GISMAPS_OVERVIEW_URL,
    source_manifest,
)


class CountyGISMapsPoseyTests(unittest.TestCase):
    def test_manifest_is_explicitly_non_authoritative(self) -> None:
        manifest = source_manifest()
        self.assertEqual(manifest["source_id"], "POSEY_COUNTYGISMAPS")
        self.assertEqual(manifest["authority_class"], "SECONDARY_DATA_SERVICE")
        self.assertEqual(manifest["parcel_geometry_authority"], "UNVERIFIED")
        self.assertEqual(manifest["property_record_authority"], "NONE")
        self.assertEqual(manifest["elevation_certification_authority"], "NONE")

    def test_urls_are_stable(self) -> None:
        self.assertEqual(
            POSEY_COUNTY_GISMAPS_URL,
            "https://countygismaps.com/map/in/posey",
        )
        self.assertEqual(
            POSEY_COUNTY_GISMAPS_OVERVIEW_URL,
            "https://countygismaps.com/in/posey",
        )


if __name__ == "__main__":
    unittest.main()
