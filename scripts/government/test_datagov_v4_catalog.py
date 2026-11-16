"""Offline test suite for the bounded Data.gov v4 metadata adapter."""
from __future__ import annotations

import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import datagov_v4_catalog as catalog


def record(identifier="dataset-one"):
    return {
        "identifier": identifier,
        "slug": identifier,
        "title": "Wabash River research data",
        "publisher": "U.S. Geological Survey",
        "has_spatial": True,
        "last_harvested_date": "2026-11-01T00:00:00Z",
        "spatial_shape": {"type": "Polygon", "coordinates": []},
        "dcat": {
            "accessLevel": "public",
            "modified": "2026-10-30",
            "license": "https://example.test/rights",
            "issued": "2026-01-01"
        }
    }


def page(rows, after=None):
    payload = {"results": rows, "sort": "relevance"}
    if after is not None:
        payload["after"] = after
    return json.dumps(payload, separators=(",", ":")).encode("utf-8")


class CatalogTests(unittest.TestCase):
    def test_build_url_stays_on_gsa_and_urlencodes_user_query(self):
        url = catalog.build_url("Ohio & Wabash", 10, "Federal Government", "geospatial", None)
        self.assertTrue(url.startswith(catalog.API + "?"))
        self.assertIn("Ohio+%26+Wabash", url)
        self.assertIn("org_type=Federal+Government", url)
        self.assertNotIn("api_key", url.lower())

    def test_url_rejects_invalid_ranges_and_filters(self):
        for kwargs in [
            ("test", 0, None, "geospatial", None),
            ("test", 51, None, "geospatial", None),
            ("test", 1, "another agency", None, None),
            ("test", 1, None, "unknown", None),
            ("test", 1, None, None, "\nfoo"),
            ("", 1, None, None, None),
        ]:
            with self.subTest(args=kwargs):
                with self.assertRaises(catalog.CatalogError):
                    catalog.build_url(*kwargs)

    def test_rejects_bad_page_shape(self):
        for data in [b"[]", b"{}", b'{"results": {}}', b'{"results":[42]}', b"{" ]:
            with self.subTest(data=data):
                with self.assertRaises(catalog.CatalogError):
                    catalog.parse_page(data)

    def test_rejects_unbounded_results_and_cursor(self):
        with self.assertRaisesRegex(catalog.CatalogError, "RESULTS_INVALID"):
            catalog.parse_page(page([record() for _ in range(51)]))
        with self.assertRaisesRegex(catalog.CatalogError, "CURSOR_INVALID"):
            catalog.parse_page(page([], "x" * 1025))

    def test_read_is_bounded_before_parse(self):
        with self.assertRaisesRegex(catalog.CatalogError, "PAGE_TOO_LARGE"):
            catalog.bounded_read(io.BytesIO(b"x" * (catalog.MAX_PAGE_BYTES + 1)))

    def test_parsing_preserves_dcat_claims_without_promoting_gis(self):
        out = catalog.normalize_dataset(record())
        self.assertEqual(out["catalog_identifier"], "dataset-one")
        self.assertEqual(out["access_level_reported"], "public")
        self.assertEqual(out["dataset_modified"], "2026-10-30")
        self.assertTrue(out["has_spatial_catalog_flag"])
        self.assertIsNone(out["horizontal_crs_verified"])
        self.assertIsNone(out["vertical_datum_verified"])
        self.assertEqual(out["engineering_use"], "PROHIBITED_UNTIL_SOURCE_VALIDATED")

    def test_replay_is_offline_and_archives_exact_source_bytes(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            fixture = root / "input.json"
            original = page([record()])
            fixture.write_bytes(original)
            with patch.object(catalog, "fetch_live", side_effect=AssertionError("network")):
                dest = catalog.ingest(query="Posey flood", output_dir=root / "out",
                                      fixture_paths=[fixture])
            saved = (dest / "page-000.json").read_bytes()
            manifest = json.loads((dest / "manifest.json").read_text())
            candidates = json.loads((dest / "candidates.json").read_text())
            self.assertEqual(saved, original)
            self.assertEqual(manifest["page_receipts"][0]["sha256"], catalog.digest(original))
            self.assertEqual(manifest["candidate_sha256"],
                             catalog.digest((dest / "candidates.json").read_bytes()))
            self.assertFalse(manifest["used_live_api"])
            self.assertFalse(manifest["source_files_promoted_to_gis"])
            self.assertFalse(manifest["has_unfetched_pages"])
            self.assertEqual(len(candidates), 1)

    def test_cursor_pagination_and_dedup(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            one, two = root / "1.json", root / "2.json"
            one.write_bytes(page([record("one")], "abc="))
            two.write_bytes(page([record("one"), record("two")]))
            dest = catalog.ingest(query="Wabash", output_dir=root / "out",
                                  fixture_paths=[one, two])
            self.assertEqual(len(json.loads((dest / "candidates.json").read_text())), 2)
            self.assertEqual(len(json.loads((dest / "manifest.json").read_text())["page_receipts"]), 2)

    def test_truncation_is_explicit_for_partial_fixture(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            fixture = root / "input.json"
            fixture.write_bytes(page([record()], "next="))
            dest = catalog.ingest(query="Wabash", output_dir=root / "out",
                                  fixture_paths=[fixture])
            self.assertTrue(json.loads((dest / "manifest.json").read_text())["has_unfetched_pages"])

    def test_rejects_repeated_cursor(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            first, second = root / "first.json", root / "second.json"
            first.write_bytes(page([record()], "loop"))
            second.write_bytes(page([record()], "loop"))
            with self.assertRaisesRegex(catalog.CatalogError, "CURSOR_LOOP"):
                catalog.ingest(query="Wabash", output_dir=root / "out",
                               fixture_paths=[first, second])

    def test_rejects_extra_fixture_after_last_page(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            first, second = root / "first.json", root / "second.json"
            first.write_bytes(page([record()]))
            second.write_bytes(page([record("two")]))
            with self.assertRaisesRegex(catalog.CatalogError, "EXTRA_FIXTURE"):
                catalog.ingest(query="Wabash", output_dir=root / "out",
                               fixture_paths=[first, second])

    def test_no_api_key_or_demo_key_in_automated_live_mode(self):
        with TemporaryDirectory() as folder:
            for key in ["", "DEMO_KEY"]:
                with self.subTest(key=key):
                    with self.assertRaisesRegex(catalog.CatalogError, "API_KEY_REQUIRED"):
                        catalog.ingest(query="Wabash", output_dir=Path(folder),
                                       live=True, api_key=key)

    def test_fixtures_and_live_are_mutually_exclusive(self):
        with self.assertRaisesRegex(catalog.CatalogError, "CHOOSE_LIVE_OR_FIXTURES"):
            catalog.ingest(query="Wabash", output_dir=Path("unused"),
                           fixture_paths=[Path("a")], live=True, api_key="valid")

    def test_snapshot_is_immutable_no_silent_overwrite(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            fixture = root / "one.json"
            fixture.write_bytes(page([record()]))
            kwargs = {"query": "Wabash", "output_dir": root / "out",
                      "fixture_paths": [fixture]}
            catalog.ingest(**kwargs)
            with self.assertRaises(FileExistsError):
                catalog.ingest(**kwargs)

    def test_redirects_are_never_followed(self):
        from urllib.request import Request
        with self.assertRaisesRegex(catalog.CatalogError, "REDIRECT_DISALLOWED"):
            catalog.NoRedirect().redirect_request(
                Request(catalog.API), None, 302, "Moved",
                {}, "https://somewhere-else.test/secret")

    def test_missing_dataset_fields_stay_unverified(self):
        item = catalog.normalize_dataset({"title": "Unknown", "has_spatial": "true"})
        self.assertIsNone(item["has_spatial_catalog_flag"])
        self.assertIsNone(item["catalog_identifier"])
        self.assertEqual(item["catalog_validation_status"], "UNVERIFIED_METADATA")


if __name__ == "__main__":
    unittest.main()
