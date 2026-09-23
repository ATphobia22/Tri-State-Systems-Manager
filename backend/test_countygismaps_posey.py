import unittest

from backend.countygismaps_posey import (
    POSEY_COUNTY_GISMAPS_URL,
    POSEY_COUNTY_GISMAPS_OVERVIEW_URL,
    source_manifest,
)


class CountyGISMapsPoseyTests(unittest.TestCase):
    def test_manifest_is_explicitly_non_authoritative(self) -> None:
        manifest = source_manifest()
        self.assertEqual(manifest["sourceId"], "POSEY_COUNTYGISMAPS")
        self.assertEqual(manifest["authorityClass"], "SECONDARY_DATA_SERVICE")
        self.assertEqual(manifest["parcelGeometryAuthority"], "UNVERIFIED")
        self.assertEqual(manifest["propertyRecordAuthority"], "NONE")
        self.assertEqual(manifest["elevationCertificationAuthority"], "NONE")

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
