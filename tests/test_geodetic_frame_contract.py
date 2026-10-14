"""Regression tests for the project's canonical horizontal CRS contract."""

import unittest

from pydantic import ValidationError

from backend.api.v1.schemas import GeodeticFrame, HORIZONTAL_CRS


class GeodeticFrameContractTests(unittest.TestCase):
    def test_accepts_canonical_horizontal_crs(self) -> None:
        frame = GeodeticFrame(horizontal_crs=HORIZONTAL_CRS, vertical_datum="NAVD88")
        self.assertEqual(frame.horizontal_crs, "EPSG:2966")

    def test_rejects_noncanonical_horizontal_crs(self) -> None:
        for horizontal_crs in ("EPSG:2967", "EPSG:4326", "WGS84", ""):
            with self.subTest(horizontal_crs=horizontal_crs):
                with self.assertRaisesRegex(
                    ValidationError, "canonical project CRS EPSG:2966"
                ):
                    GeodeticFrame(
                        horizontal_crs=horizontal_crs,
                        vertical_datum="NAVD88",
                    )


if __name__ == "__main__":
    unittest.main()
