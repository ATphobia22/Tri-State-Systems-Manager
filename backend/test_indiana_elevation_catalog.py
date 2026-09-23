import unittest

from backend.indiana_elevation_catalog import source_manifest


class IndianaElevationCatalogTests(unittest.TestCase):
    def test_manifest_is_state_managed_and_fail_closed(self) -> None:
        manifest = source_manifest()
        self.assertEqual(manifest["authority_class"], "STATE_MANAGED_ELEVATION_ARCHIVE")
        self.assertEqual(manifest["license"], "CC0")
        self.assertEqual(manifest["professional_certification_authority"], "NONE")
        self.assertEqual(manifest["survey_control_authority"], "NONE")
        self.assertEqual(manifest["regulatory_determination_authority"], "NONE")
        self.assertEqual(manifest["bucket_arn"], "arn:aws:s3:::giselevationingov")


if __name__ == "__main__":
    unittest.main()
