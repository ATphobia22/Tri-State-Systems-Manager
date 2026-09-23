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

    def test_manifest_is_bound_to_immutable_registry_snapshot(self) -> None:
        manifest = source_manifest()
        self.assertEqual(
            manifest["registry_commit"],
            "00eb38722ad0a2d9ac0bd50d23f3ba0f11b10dfb",
        )
        self.assertEqual(manifest["registry_path"], "datasets/in-elevation.yaml")
        self.assertEqual(
            manifest["registry_blob_sha"],
            "f2a5169cbae250c297679bc281abdc4c2ddc3e85",
        )


if __name__ == "__main__":
    unittest.main()
