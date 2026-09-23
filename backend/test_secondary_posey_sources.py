import unittest

from backend.equator_posey import source_manifest as equator_manifest
from backend.landrecords_posey import source_manifest as landrecords_manifest


class SecondaryPoseySourceTests(unittest.TestCase):
    def test_equator_manifest_is_fail_closed(self) -> None:
        manifest = equator_manifest()
        self.assertEqual(manifest["authority_class"], "SECONDARY_COMMERCIAL_GIS")
        self.assertEqual(manifest["parcel_geometry_authority"], "UNVERIFIED")
        self.assertEqual(manifest["elevation_certification_authority"], "NONE")

    def test_landrecords_manifest_is_fail_closed(self) -> None:
        manifest = landrecords_manifest()
        self.assertEqual(manifest["authority_class"], "SECONDARY_NATIONAL_PARCEL_DATASET")
        self.assertEqual(manifest["parcel_geometry_authority"], "UNVERIFIED")
        self.assertEqual(manifest["elevation_certification_authority"], "NONE")


if __name__ == "__main__":
    unittest.main()
