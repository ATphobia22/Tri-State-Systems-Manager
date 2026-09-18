from __future__ import annotations

import unittest

from indiana_elevation import (
    DEFAULT_OUTPUT_SRID,
    BoundingBox,
    build_export_url,
    parse_bbox,
    validate_service_metadata,
)


class IndianaElevationContractTests(unittest.TestCase):
    def test_parse_bbox_rejects_invalid_order(self) -> None:
        with self.assertRaises(ValueError):
            parse_bbox("1,2,3,2")

    def test_parse_bbox_is_finite(self) -> None:
        bbox = parse_bbox("-87.95,37.84,-87.90,37.90")
        self.assertEqual(bbox, BoundingBox(-87.95, 37.84, -87.90, 37.90))

    def test_export_url_preserves_output_crs_and_safe_resampling(self) -> None:
        url = build_export_url(
            "https://example.test/ImageServer",
            BoundingBox(-87.95, 37.84, -87.90, 37.90),
            4326,
            256,
            256,
            "RSP_NearestNeighbor",
        )
        self.assertIn("imageSR=2966", url)
        self.assertIn("bboxSR=4326", url)
        self.assertIn("pixelType=F32", url)
        self.assertIn("RSP_NearestNeighbor", url)
        self.assertEqual(DEFAULT_OUTPUT_SRID, 2966)

    def test_service_metadata_requires_image_server_when_type_is_present(self) -> None:
        validate_service_metadata(
            {
                "type": "ImageServer",
                "capabilities": "Image,Metadata",
                "spatialReference": {"wkid": 3857},
            }
        )
        with self.assertRaises(RuntimeError):
            validate_service_metadata(
                {"type": "FeatureServer", "capabilities": "Query"}
            )

    def test_service_metadata_rejects_malformed_spatial_reference(self) -> None:
        with self.assertRaises(RuntimeError):
            validate_service_metadata(
                {
                    "type": "ImageServer",
                    "capabilities": "Image",
                    "spatialReference": "EPSG:3857",
                }
            )


if __name__ == "__main__":
    unittest.main()
