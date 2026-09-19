from datetime import datetime, timezone
import unittest

from backend.geospatial.indiana_map.contracts import validate_dataset
from backend.geospatial.temporal_provenance import TemporalProvenance


class GeospatialContractTests(unittest.TestCase):
    def test_indiana_map_contract_requires_metadata(self) -> None:
        record = validate_dataset({
            "dataset_id": "Indiana_2016_2020_DEM",
            "title": "Indiana statewide LiDAR-derived DEM",
            "service_url": "https://indianamap.org/arcgis/rest/services/example/ImageServer",
            "service_type": "ImageServer",
            "source_agency": "Indiana Geographic Information Office",
            "authority_class": "authoritative_government",
            "spatial_reference": "EPSG:3857",
            "vertical_datum": "NAVD88",
        })
        self.assertEqual(record.dataset_id, "Indiana_2016_2020_DEM")

    def test_indiana_map_contract_rejects_untrusted_service_type(self) -> None:
        with self.assertRaisesRegex(ValueError, "unsupported service_type"):
            validate_dataset({
                "dataset_id": "x", "title": "x", "service_url": "https://example.gov/x",
                "service_type": "database", "source_agency": "x",
                "authority_class": "reference", "spatial_reference": "EPSG:4326",
            })

    def test_temporal_provenance_normalizes_to_utc(self) -> None:
        result = TemporalProvenance(
            datetime(2026, 9, 19, 1, tzinfo=timezone.utc),
            datetime(2026, 9, 19, 2, tzinfo=timezone.utc),
        )
        self.assertEqual(result.valid_time.tzinfo, timezone.utc)

    def test_temporal_provenance_rejects_future_change_time(self) -> None:
        with self.assertRaisesRegex(ValueError, "change_time"):
            TemporalProvenance(
                datetime(2026, 9, 19, 1, tzinfo=timezone.utc),
                datetime(2026, 9, 19, 2, tzinfo=timezone.utc),
                datetime(2026, 9, 19, 3, tzinfo=timezone.utc),
            )


if __name__ == "__main__":
    unittest.main()
