"""Deterministic tests for the OpenFEMA v2 client. HTTP is stubbed; no live calls."""

import json
import unittest
from unittest.mock import patch

from backend.geospatial.fema import openfema_client as ofc


class QueryTests(unittest.TestCase):
    @patch.object(
        ofc.urllib.request,
        "urlopen",
        side_effect=Exception("no network in tests"),
    )
    def test_fail_closed_on_transport_error(self, _mock):
        result = ofc.query_dataset("DisasterDeclarationsSummaries")
        self.assertEqual(result["status"], "UNAVAILABLE")
        self.assertIn("reason", result)
        self.assertNotIn("records", result)

    def test_posey_declarations_fail_closed(self):
        with patch.object(ofc, "query_dataset", return_value={"status": "UNAVAILABLE", "reason": "x", "dataset": "d"}):
            result = ofc.posey_county_declarations()
            self.assertEqual(result["status"], "UNAVAILABLE")

    def test_builds_odata_url(self):
        seen = {}

        class _Resp:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read(self):
                return json.dumps({"DisasterDeclarationsSummaries": []}).encode()

        # json.load needs a file-like with read(); urllib response works via read
        import io

        def fake_urlopen(req, timeout=None):
            seen["url"] = req.full_url

            class R:
                status = 200

                def __enter__(self):
                    return self

                def __exit__(self, *a):
                    return False

                def read(self):
                    return b'{"DisasterDeclarationsSummaries": []}'

            return R()

        with patch.object(ofc.urllib.request, "urlopen", side_effect=fake_urlopen):
            result = ofc.query_dataset(
                "DisasterDeclarationsSummaries",
                odata_filter="state eq 'IN'",
                select="disasterNumber",
                top=5,
            )
        self.assertEqual(result["status"], "OBSERVED")
        self.assertIn("DisasterDeclarationsSummaries", seen["url"])
        self.assertIn("%24filter", seen["url"])
        self.assertEqual(result["records"], [])


if __name__ == "__main__":
    unittest.main()
