"""Deterministic, offline tests of OpenFEMA bounds, hashes and authority limits."""
import hashlib
import json
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from backend.geospatial.fema import openfema_client as ofc


class FakeResponse:
    status = 200
    def __init__(self, data, url=None):
        self.data = data if isinstance(data, bytes) else json.dumps(data).encode()
        self.url = url
    def __enter__(self):
        return self
    def __exit__(self, *_):
        return False
    def read(self, *_):
        return self.data
    def geturl(self):
        return self.url


def run_pages(pages, **options):
    seen = []
    def open_url(req, timeout=None):
        url = req.full_url
        seen.append(url)
        qs = parse_qs(urlsplit(url).query)
        skip = int(qs["$skip"][0])
        top = int(qs["$top"][0])
        index = len(seen) - 1
        entries = pages[index] if index < len(pages) else []
        return FakeResponse({"DisasterDeclarationsSummaries": entries[:top]}, url)
    with patch.object(ofc.urllib.request, "urlopen", side_effect=open_url):
        result = ofc.query_dataset("DisasterDeclarationsSummaries",
                                   orderby="disasterNumber asc", **options)
    return result, seen


class OpenFemaClientTests(unittest.TestCase):
    def test_transport_failure_has_no_fabricated_rows(self):
        with patch.object(ofc.urllib.request, "urlopen", side_effect=OSError("offline")):
            result = ofc.query_dataset("DisasterDeclarationsSummaries")
        self.assertEqual(result["status"], "UNAVAILABLE")
        self.assertFalse(result["complete"])
        self.assertNotIn("records", result)

    def test_posey_query_uses_county_filter(self):
        with patch.object(ofc, "query_dataset", return_value={"status": "UNAVAILABLE"}) as call:
            ofc.posey_county_declarations()
        self.assertIn("fipsCountyCode eq '129'", call.call_args.kwargs["odata_filter"])
        self.assertIn("declarationDate desc", call.call_args.kwargs["orderby"])

    def test_source_url_and_sha256_for_complete_two_page_sample(self):
        result, seen = run_pages([[{"id": "one"}, {"id": "two"}],
                                  [{"id": "three"}]], top=2, max_pages=5)
        self.assertEqual(result["status"], "OBSERVED")
        self.assertTrue(result["complete"])
        self.assertEqual([x["id"] for x in result["records"]], ["one", "two", "three"])
        self.assertEqual(len(result["page_receipts"]), 2)
        self.assertEqual(parse_qs(urlsplit(seen[1]).query)["$skip"], ["2"])
        self.assertEqual(result["page_receipts"][0]["bytes"],
                         len(json.dumps({"DisasterDeclarationsSummaries": [
                             {"id": "one"}, {"id": "two"}]}).encode()))
        self.assertEqual(len(result["page_receipts"][0]["sha256"]), 64)

    def test_single_full_page_is_partial_not_complete(self):
        result, _ = run_pages([[{"id": 1}, {"id": 2}]], top=2, max_pages=1)
        self.assertEqual(result["status"], "PARTIAL")
        self.assertFalse(result["complete"])
        self.assertEqual(result["reason"], "MAX_PAGES_REACHED")

    def test_record_cap_is_explicit(self):
        result, _ = run_pages([[{"id": 1}, {"id": 2}]], top=2, max_records=2)
        self.assertEqual(result["status"], "PARTIAL")
        self.assertEqual(result["reason"], "MAX_RECORDS_REACHED")

    def test_non_allowlisted_or_invalid_arguments_cannot_be_queried(self):
        for opts in [
            {"dataset": "http://attacker.example"},
            {"dataset": "disasterdeclarationssummaries"},
            {"top": 0}, {"top": 10001}, {"max_pages": 0},
            {"max_records": -1}, {"select": "id;drop table"},
            {"orderby": "id;delete"}, {"odata_filter": "state eq 'IN'\nBad"},
        ]:
            args = {"dataset": "DisasterDeclarationsSummaries", **opts}
            result = ofc.query_dataset(**args)
            self.assertEqual(result["status"], "UNAVAILABLE")
            self.assertFalse(result["complete"])
            self.assertNotIn("records", result)

    def test_deprecated_dataset_version_is_exposed(self):
        def fetch(req, timeout=None):
            return FakeResponse({"FimaNfipClaims": []}, req.full_url)
        with patch.object(ofc.urllib.request, "urlopen", side_effect=fetch):
            result = ofc.query_dataset("FimaNfipClaims")
        self.assertTrue(result["deprecatedDataset"])
        self.assertEqual(result["apiVersion"], 2)

    def test_current_nfip_dataset_uses_v3(self):
        def fetch(req, timeout=None):
            return FakeResponse({"NfipPolicies": []}, req.full_url)
        with patch.object(ofc.urllib.request, "urlopen", side_effect=fetch):
            result = ofc.query_dataset("NfipPolicies")
        self.assertEqual(result["apiVersion"], 3)
        self.assertFalse(result["deprecatedDataset"])
        self.assertEqual(result["status"], "OBSERVED")

    def test_wrong_envelope_cannot_be_reported_as_empty_complete(self):
        with patch.object(ofc.urllib.request, "urlopen",
                          return_value=FakeResponse({"notDataset": []})):
            result = ofc.query_dataset("DisasterDeclarationsSummaries")
        self.assertEqual(result["status"], "UNAVAILABLE")
        self.assertNotIn("records", result)

    def test_wrong_item_type_is_rejected(self):
        with patch.object(ofc.urllib.request, "urlopen",
                          return_value=FakeResponse({"DisasterDeclarationsSummaries": ["oops"]})):
            result = ofc.query_dataset("DisasterDeclarationsSummaries")
        self.assertEqual(result["status"], "UNAVAILABLE")

    def test_untrusted_nextlink_is_not_followed(self):
        urls = []
        def get(req, timeout=None):
            urls.append(req.full_url)
            result = [{"id": 1}] if len(urls) == 1 else []
            return FakeResponse({"DisasterDeclarationsSummaries": result,
                                 "@odata.nextLink": "https://evil.invalid/steal"}, req.full_url)
        with patch.object(ofc.urllib.request, "urlopen", side_effect=get):
            value = ofc.query_dataset("DisasterDeclarationsSummaries", top=1)
        self.assertEqual(value["status"], "OBSERVED")
        self.assertEqual(len(urls), 2)
        self.assertTrue(all(x.startswith("https://www.fema.gov/api/open/v2/") for x in urls))

    def test_redirected_origin_fails(self):
        def fake(req, timeout=None):
            return FakeResponse({"DisasterDeclarationsSummaries": []},
                                "https://other.invalid/redirect")
        with patch.object(ofc.urllib.request, "urlopen", side_effect=fake):
            result = ofc.query_dataset("DisasterDeclarationsSummaries")
        self.assertEqual(result["status"], "UNAVAILABLE")

    def test_page_failure_after_data_retains_partial_status(self):
        n = 0
        def fake(req, timeout=None):
            nonlocal n
            n += 1
            if n == 2:
                raise OSError("lost network")
            return FakeResponse({"DisasterDeclarationsSummaries": [{"id": 1}]}, req.full_url)
        with patch.object(ofc.urllib.request, "urlopen", side_effect=fake):
            result = ofc.query_dataset("DisasterDeclarationsSummaries", top=1)
        self.assertEqual(result["status"], "PARTIAL")
        self.assertFalse(result["complete"])
        self.assertEqual(len(result["records"]), 1)

    def test_empty_page_is_complete(self):
        value, _ = run_pages([[]], top=2)
        self.assertEqual(value["status"], "OBSERVED")
        self.assertEqual(value["records"], [])

    def test_max_response_bytes_are_checked(self):
        with patch.object(ofc.urllib.request, "urlopen",
                          return_value=FakeResponse(b"x" * (ofc._MAX_RESPONSE_BYTES + 1))):
            value = ofc.query_dataset("DisasterDeclarationsSummaries")
        self.assertEqual(value["status"], "UNAVAILABLE")


if __name__ == "__main__":
    unittest.main()
