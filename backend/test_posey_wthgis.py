"""Tests for the Posey County WTHGIS source adapter."""

from __future__ import annotations

import unittest

from backend.posey_wthgis import PoseyGISSource, source_manifest


class PoseyWTHGISTests(unittest.TestCase):
    def test_source_manifest_identifies_county_gis(self) -> None:
        manifest = source_manifest()
        self.assertEqual(manifest["source_id"], "POSEY_WTHGIS")
        self.assertIn("Posey County", manifest["authority"])

    def test_property_record_url_is_deterministic(self) -> None:
        source = PoseyGISSource()
        url = source.property_record_url(20501)
        self.assertIn("DSID=205", url)
        self.assertIn("FeatureID=20501", url)
        self.assertIn("RequestType=PropertyRecordCard", url)

    def test_tax_history_url_is_deterministic(self) -> None:
        source = PoseyGISSource()
        url = source.tax_history_url(20501)
        self.assertIn("RequestType=TaxHistoryData", url)

    def test_invalid_feature_id_fails_closed(self) -> None:
        source = PoseyGISSource()
        with self.assertRaises(ValueError):
            source.property_record_url(0)


if __name__ == "__main__":
    unittest.main()
