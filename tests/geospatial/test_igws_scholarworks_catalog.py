"""Synthetic, offline tests: bibliography is not a geospatial source or survey."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "igws_catalog", ROOT / "scripts/geospatial/igws_scholarworks_catalog.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ScholarWorksCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = MODULE.load_catalog()
        cls.record = cls.catalog["records"][0]

    def test_catalog_has_real_item_identifiers_and_pinned_legacy_limits(self):
        summary = MODULE.verify_catalog(self.catalog)
        self.assertEqual(summary["catalogRecords"], 9)
        self.assertEqual(summary["explicitLocalHistoricalReferences"], 5)
        self.assertEqual(summary["rightsConflictsRequiringReview"], 5)
        self.assertEqual(summary["licensedPdfFilesDownloaded"], 0)
        self.assertFalse(summary["surveyOrRegulatoryApprovalEstablished"])

    def test_public_catalog_mirrors_reviewed_source_bytes(self):
        MODULE.verify_public_mirror(MODULE.CATALOG, MODULE.PUBLIC_CATALOG)

    def test_reject_outdated_public_mirror(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / "source.json"
            published = Path(folder) / "public.json"
            source.write_bytes(b"{\"source\":1}")
            published.write_bytes(b"{\"source\":2}")
            with self.assertRaisesRegex(ValueError, "Static public IGWS catalog drift"):
                MODULE.verify_public_mirror(source, published)

    def test_untrusted_uri_cannot_substitute_for_an_iu_source(self):
        item = copy.deepcopy(self.catalog)
        item["records"][0]["sourcePdfUrl"] = "https://phishing.example/download"
        with self.assertRaisesRegex(ValueError, "PDF locator"):
            MODULE.verify_catalog(item)

    def test_changed_item_uuid_and_page_mismatch(self):
        item = copy.deepcopy(self.catalog)
        item["records"][0]["itemId"] = "0" * 8 + "-0000-0000-0000-000000000001"
        with self.assertRaisesRegex(ValueError, "source page"):
            MODULE.verify_catalog(item)

    def test_duplicate_persistent_identifier_is_rejected(self):
        item = copy.deepcopy(self.catalog)
        item["records"][1]["handleUri"] = item["records"][0]["handleUri"]
        with self.assertRaisesRegex(ValueError, "duplicate/invalid persistent handle"):
            MODULE.verify_catalog(item)

    def test_not_a_measured_or_georeferenced_survey(self):
        for change in ({"sourceVerticalDatum": "NAVD88"},
                       {"sourceHorizontalCrs": "EPSG:2966"},
                       {"independentSurveyEvidence": True},
                       {"regulatoryUse": True}):
            item = copy.deepcopy(self.catalog)
            item["records"][0].update(change)
            with self.assertRaises(ValueError):
                MODULE.verify_catalog(item)

    def test_cannot_invent_download_or_lift_content_license(self):
        for change in ({"sourceBinarySha256": "f" * 64},
                       {"publicationPdfBundlingPermitted": True},
                       {"downloadStatus": "SOURCE_BINARY_DOWNLOADED"}):
            item = copy.deepcopy(self.catalog)
            item["records"][0].update(change)
            with self.assertRaises(ValueError):
                MODULE.verify_catalog(item)

    def test_unknown_map_scale_is_preserved_not_inferred(self):
        item = copy.deepcopy(self.catalog)
        self.assertIsNone(item["records"][0]["scaleDenominator"])
        item["records"][0]["scaleDenominator"] = "1:24000"
        with self.assertRaisesRegex(ValueError, "map scale"):
            MODULE.verify_catalog(item)

    def make_api_bytes(self, record=None):
        record = record or self.record
        data = {
            "id": record["itemId"], "handle": record["handleUri"].replace("https://hdl.handle.net/", ""),
            "withdrawn": False, "inArchive": True,
            "lastModified": "2025-11-17T00:00:00Z",
            "metadata": {
                "dc.title": [{"value": record["title"]}],
                "dc.date.issued": [{"value": str(record["publicationYear"])}],
                "dc.identifier.uri": [{"value": record["handleUri"]}],
                "dc.rights": [{"value": "This work is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 2.5 License"}],
                "dc.rights.uri": [{"value": record["sourceRightsUri"]}],
            }
        }
        return json.dumps(data, ensure_ascii=False).encode("utf-8")

    def test_source_metadata_identity_check_hashes_exact_api_bytes(self):
        source = self.make_api_bytes()
        report = MODULE.verify_dspace_item(self.record, source)
        self.assertEqual(report["rawMetadataSha256"], hashlib.sha256(source).hexdigest())
        self.assertFalse(report["pdfDownloaded"])
        self.assertFalse(report["scientificConformance"])
        self.assertEqual(report["rightsReview"], "SINGLE_NONCOMMERCIAL_NOTICE")

    def test_changed_title_and_year_are_detected(self):
        for field, value, expected in (
            ("dc.title", "Unrelated geological map", "title changed"),
            ("dc.date.issued", "2030", "publication year changed"),
        ):
            document = json.loads(self.make_api_bytes())
            document["metadata"][field][0]["value"] = value
            with self.assertRaisesRegex(ValueError, expected):
                MODULE.verify_dspace_item(self.record, json.dumps(document).encode())

    def test_changed_rights_uri_requires_review(self):
        data = json.loads(self.make_api_bytes())
        data["metadata"]["dc.rights.uri"][0]["value"] = "https://creativecommons.org/licenses/by/4.0/"
        with self.assertRaisesRegex(ValueError, "rights URI changed"):
            MODULE.verify_dspace_item(self.record, json.dumps(data).encode())

    def test_record_missing_rights_and_withdrawn_record_rejected(self):
        data = json.loads(self.make_api_bytes())
        data["metadata"]["dc.rights"] = []
        data["metadata"]["dc.rights.uri"] = []
        with self.assertRaisesRegex(ValueError, "rights"):
            MODULE.verify_dspace_item(self.record, json.dumps(data).encode())
        data = json.loads(self.make_api_bytes())
        data["withdrawn"] = True
        with self.assertRaisesRegex(ValueError, "withdrawn"):
            MODULE.verify_dspace_item(self.record, json.dumps(data).encode())

    def test_fake_network_source_cannot_download_pdf_or_build_geometry(self):
        calls = []
        def fake_fetch(url):
            calls.append(url)
            record = next(v for v in self.catalog["records"] if v["metadataApi"] == url)
            return self.make_api_bytes(record)
        report = MODULE.refresh_metadata(self.catalog, fetch=fake_fetch)
        self.assertEqual(len(calls), 9)
        self.assertTrue(all("/api/core/items/" in u for u in calls))
        self.assertEqual(report["sourceBinaryFilesDownloaded"], 0)
        self.assertFalse(report["geospatialConformance"])
        self.assertEqual(len(report["records"]), 9)

    def test_requested_metadata_download_is_exact_and_non_overwriting(self):
        source = self.make_api_bytes()
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            # All nine mock responses use a corresponding ID and handle.
            MODULE.refresh_metadata(self.catalog,
                fetch=lambda url: self.make_api_bytes(
                    next(r for r in self.catalog["records"] if r["metadataApi"] == url)),
                metadata_dir=path)
            saved = path / (self.record["itemId"] + ".json")
            self.assertEqual(saved.read_bytes(), source)
            self.assertEqual(len(list(path.glob("*.json"))), 9)
            with self.assertRaises(FileExistsError):
                MODULE.refresh_metadata(self.catalog,
                    fetch=lambda url: self.make_api_bytes(
                        next(r for r in self.catalog["records"] if r["metadataApi"] == url)),
                    metadata_dir=path)


if __name__ == "__main__":
    unittest.main()
