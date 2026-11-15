"""Geoportal-inspired text/facet/extent discovery does not claim regulatory coverage."""
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "tools/geospatial_exchange/metadata_catalog_query.py"
spec = importlib.util.spec_from_file_location("metadata_catalog_query", TARGET)
query = importlib.util.module_from_spec(spec)
spec.loader.exec_module(query)


class SearchTests(unittest.TestCase):
    def setUp(self):
        self.catalog = {
            "schema": "tsm-normalized-geospatial-metadata",
            "records": [{
                "metadataFamily": "FGDC_CSDGM",
                "verificationStatus": "PARSED_UNVERIFIED",
                "title": "FEMA flood source metadata",
                "abstract": "Contains description of NFHL",
                "sourceReportedOrganization": "FEMA",
                "themeKeywordsReported": ["hydrology"],
                "geographicExtentReported": [-88.5, 37.5, -87.5, 38.5],
            }, {
                "metadataFamily": "ISO_19139",
                "verificationStatus": "PARSED_UNVERIFIED",
                "title": "Other geology metadata",
                "abstract": None,
                "sourceReportedOrganization": None,
                "themeKeywordsReported": ["geology"],
                "geographicExtentReported": None,
            }]
        }

    def test_casefold_keyword_facets(self):
        result = query.search(self.catalog, keyword="flood", family="FGDC_CSDGM")
        self.assertEqual(result["matchCount"], 1)
        self.assertEqual(result["authority"], "NOT_ESTABLISHED")

    def test_bbox_filters_on_reported_extent_only(self):
        result = query.search(self.catalog, extent=[-88.2, 37.9, -88.0, 38.1])
        self.assertEqual(result["matchCount"], 1)
        self.assertEqual(result["spatialMatchScope"], "REPORTED_METADATA_BBOX_ONLY_NOT_VERIFIED")

    def test_nonoverlap_returns_no_matches(self):
        self.assertEqual(query.search(self.catalog, extent=[-90, 40, -89, 41])["matchCount"], 0)

    def test_unknown_extent_is_not_coverage(self):
        self.assertEqual(query.search(self.catalog, keyword="geology", extent=[-90, 37, -80, 40])["matchCount"], 0)

    def test_invalid_input_refused(self):
        with self.assertRaisesRegex(ValueError, "Extent"):
            query.search(self.catalog, extent=[float("nan"), 0, 2, 3])
        with self.assertRaisesRegex(ValueError, "Not a TSM"):
            query.search({"records": []})

    def test_verified_promotion_not_inferred(self):
        self.catalog["records"][0]["verificationStatus"] = "INDEPENDENTLY_REVIEWED"
        with self.assertRaisesRegex(ValueError, "unexpected verification"):
            query.search(self.catalog)


if __name__ == "__main__":
    unittest.main()
