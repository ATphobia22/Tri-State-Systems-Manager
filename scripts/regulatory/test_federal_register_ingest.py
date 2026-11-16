"""Offline contract tests. No real Federal Register requests or network access."""
import argparse
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import federal_register_ingest as fr


def page(items, next_url=None):
    return json.dumps({"results": items, "next_page_url": next_url},
                      separators=(",", ":")).encode("utf-8")


def document(number="2013-11586", title="Proposed Flood Hazard Determinations"):
    return {
        "document_number": number,
        "title": title,
        "type": "PRORULE",
        "publication_date": "2013-05-16",
        "agency_names": ["Federal Emergency Management Agency"],
        "citation": "78 FR 28888",
        "html_url": "https://www.federalregister.gov/d/2013-11586",
        "pdf_url": "https://www.govinfo.gov/content/pkg/FR-2013-05-16/pdf/2013-11586.pdf",
        "docket_id": ["FEMA-B-1315"],
        "regulation_id_numbers": [],
    }


class FederalRegisterIngestTests(unittest.TestCase):
    def test_offline_fixture_provenance_raw_hash_and_guards(self):
        with TemporaryDirectory() as tmp:
            folder = Path(tmp)
            fixture = folder / "fixture.json"
            raw = page([document()])
            fixture.write_bytes(raw)
            output = folder / "evidence.json"
            args = argparse.Namespace(live=False, fixture=fixture, term="flood",
                since="2013-05-16", until="2013-05-16", per_page=20, max_pages=2,
                output=output)
            with patch.object(fr, "fetch_api", side_effect=AssertionError("NO NETWORK")):
                manifest = fr.run(args)
            archived = output.parent / manifest["raw_response_files"][0]["file"]
            self.assertEqual(archived.read_bytes(), raw)
            self.assertEqual(manifest["raw_response_files"][0]["sha256"],
                             hashlib.sha256(raw).hexdigest())
            self.assertEqual(json.loads(output.read_text())["documents"][0]["document_number"],
                             "2013-11586")
            self.assertEqual(manifest["documents"][0]["jurisdiction_applicability"], "NOT_ASSESSED")
            self.assertFalse(manifest["grants_opportunity_verified"])
            self.assertFalse(manifest["official_legal_effect_verified"])
            self.assertTrue(manifest["human_authority_final"])
            self.assertIsNone(manifest["vertical_datum"])

    def test_only_fixed_host_search_request(self):
        url = fr.query_url("floodway", "2026-01-01", "2026-11-16", 1, 20)
        self.assertIn("conditions%5Bterm%5D=floodway", url)
        self.assertIn("fields%5B%5D=document_number", url)
        for bad in ["http://www.federalregister.gov/api/v1/documents.json?a=b",
                    "https://evil.gov/api/v1/documents.json",
                    "https://www.federalregister.gov/other"]:
            with self.assertRaises(ValueError):
                fr.fetch_api(bad)

    def test_bounded_pagination_and_date_order(self):
        with self.assertRaises(ValueError):
            fr.query_url("flood", None, None, 6, 20)
        with self.assertRaises(ValueError):
            fr.query_url("flood", "2026-11-16", "2026-01-01", 1, 20)
        with self.assertRaises(ValueError):
            fr.check_day("2026-02-30")
        with self.assertRaises(ValueError):
            fr.query_url("", None, None, 1, 20)

    def test_deduplication_is_stable(self):
        raw = page([document(), document()])
        manifest, blobs = fr.create_snapshot([("local-fixture:test", raw)], "flood",
                     retrieved_at="2026-11-16T00:00:00+00:00")
        self.assertEqual(len(manifest["documents"]), 1)
        self.assertEqual(blobs, [raw])

    def test_conflicting_same_id_is_rejected(self):
        raw = page([document(), document(title="Conflicting")])
        with self.assertRaisesRegex(ValueError, "Conflicting"):
            fr.create_snapshot([("local-fixture:test", raw)], "flood")

    def test_untrusted_source_links_are_rejected(self):
        item = document()
        item["html_url"] = "https://attacker.test/forged-order"
        with self.assertRaisesRegex(ValueError, "Untrusted"):
            fr.parse_page(page([item]))

    def test_missing_source_identity_is_rejected(self):
        item = document()
        item.pop("document_number")
        with self.assertRaisesRegex(ValueError, "document_number"):
            fr.parse_page(page([item]))

    def test_malformed_payload_cannot_be_silent_success(self):
        for raw in [b"{}", b"[]", b'{"results":null}', b'{"results":"x"}']:
            with self.assertRaises(ValueError):
                fr.parse_page(raw)

    def test_response_size_cap(self):
        with self.assertRaisesRegex(ValueError, "4 MiB"):
            fr.parse_page(b" " * (fr.MAX_RESPONSE_BYTES + 1))

    def test_paging_metadata_is_not_followed(self):
        raw = page([document()], "https://attacker.test/malicious-page")
        documents, has_next = fr.parse_page(raw)
        self.assertEqual(len(documents), 1)
        self.assertTrue(has_next)

    def test_redirects_rejected(self):
        with self.assertRaisesRegex(ValueError, "redirect"):
            fr.NoRedirect().redirect_request(None, None, 302, "Moved", {},
                                             "https://attacker.test/next")


if __name__ == "__main__":
    unittest.main()
