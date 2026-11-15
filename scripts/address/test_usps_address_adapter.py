#!/usr/bin/env python3
"""Network-free USPS license, privacy and API-contract tests."""
import io
import json
import unittest
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse

from usps_address_adapter import (
    ADDRESS_ENDPOINT, TOKEN_ENDPOINT, USPSAdapterError,
    checked_address, standardize,
)

ENABLED = {
    "TSM_USPS_ADDRESSES_ENABLED": "1", "TSM_USPS_LICENSE_APPROVED": "1",
    "TSM_USPS_CLIENT_ID": "id-in-memory", "TSM_USPS_CLIENT_SECRET": "secret-in-memory",
}


class FakeOpener:
    def __init__(self, *, broken=None, outside=False):
        self.calls = []
        self.broken = broken
        self.outside = outside

    def __call__(self, request, timeout):
        self.calls.append((request, timeout))
        if self.broken == len(self.calls):
            raise HTTPError(request.full_url, 403, "Forbidden", {}, None)
        if request.full_url == TOKEN_ENDPOINT:
            assert request.get_method() == "POST"
            return io.BytesIO(json.dumps({"access_token": "ephemeral-test-token"}).encode())
        assert urlparse(request.full_url).path == "/addresses/v3/address"
        assert request.get_header("Authorization") == "Bearer ephemeral-test-token"
        return io.BytesIO(json.dumps({
            "address": {"streetAddress": "123 MAIN ST", "city": "MOUNT VERNON",
                        "state": "OH" if self.outside else "IN",
                        "ZIPCode": "47620", "ZIPPlus4": "1234"},
            "additionalInfo": {"carrierRoute": "C001", "deliveryPoint": "11",
                               "DPVConfirmation": "Y", "business": "N"},
            "recipient": "do not retain",
        }).encode())


class AddressAdapterTests(unittest.TestCase):
    def test_disabled_by_default_never_accesses_network(self):
        fake = FakeOpener()
        with self.assertRaisesRegex(USPSAdapterError, "disabled"):
            standardize("123 Main St", "Mount Vernon", "IN", env={}, opener=fake)
        self.assertEqual(fake.calls, [])

    def test_license_precondition_is_not_bypassed(self):
        fake = FakeOpener()
        env = dict(ENABLED, TSM_USPS_LICENSE_APPROVED="0")
        with self.assertRaisesRegex(USPSAdapterError, "license"):
            standardize("123 Main St", "Mount Vernon", "IN", env=env, opener=fake)
        self.assertEqual(fake.calls, [])

    def test_required_secrets_do_not_appear_in_result(self):
        fake = FakeOpener()
        result = standardize("123 Main St", "Mount Vernon", "in", "47620",
                             env=ENABLED, opener=fake)
        data = json.dumps(result)
        for forbidden in ("secret-in-memory", "ephemeral-test-token", "deliveryPoint",
                          "carrierRoute", "DPVConfirmation", "recipient"):
            self.assertNotIn(forbidden, data)
        self.assertEqual(result["status"], "POSTAL_STANDARDIZED_UNLINKED")
        self.assertFalse(result["parcel_link_verified"])
        self.assertFalse(result["engineering_use"])
        self.assertEqual(len(fake.calls), 2)
        self.assertEqual(fake.calls[0][0].full_url, TOKEN_ENDPOINT)
        self.assertEqual(urlparse(fake.calls[1][0].full_url).scheme, "https")
        self.assertEqual(parse_qs(urlparse(fake.calls[1][0].full_url).query)["ZIPCode"], ["47620"])

    def test_invalid_region_and_zip_rejected(self):
        with self.assertRaisesRegex(USPSAdapterError, "Only IN"):
            checked_address("1 Road", "City", "OH")
        with self.assertRaisesRegex(USPSAdapterError, "ZIP"):
            checked_address("1 Road", "City", "KY", "badZIP")
        with self.assertRaisesRegex(USPSAdapterError, "invalid"):
            checked_address("https://bad.example", "City", "IN")

    def test_reject_foreign_state_response(self):
        with self.assertRaisesRegex(USPSAdapterError, "outside requested"):
            standardize("123 Main St", "Mount Vernon", "IN",
                         env=ENABLED, opener=FakeOpener(outside=True))

    def test_http_errors_do_not_expose_address_or_response_body(self):
        for phase in (1, 2):
            with self.subTest(phase=phase), self.assertRaisesRegex(USPSAdapterError, "HTTP request failed: 403") as caught:
                standardize("123 Main St", "Mount Vernon", "IN", env=ENABLED,
                             opener=FakeOpener(broken=phase))
            self.assertNotIn("123 Main St", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
