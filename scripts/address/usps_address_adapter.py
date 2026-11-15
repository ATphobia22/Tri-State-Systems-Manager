#!/usr/bin/env python3
"""Optional *server-side* USPS Addresses 3.x client for IN/IL/KY.

No API calls unless the operator explicitly enables the connector AND confirms
that the appropriate USPS API license is approved. Never cache address payloads,
OAuth tokens or consumer credentials. Postal validity is NOT a surveyed parcel
coordinate or flood/elevation determination.
"""
from __future__ import annotations

import argparse
import json
import os
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

TOKEN_ENDPOINT = "https://apis.usps.com/oauth2/v3/token"
ADDRESS_ENDPOINT = "https://apis.usps.com/addresses/v3/address"
ALLOWED_STATES = frozenset({"IN", "IL", "KY"})
SAFE_TEXT = re.compile(r"^[\w #,.'\-/]{1,120}$", re.UNICODE)


class USPSAdapterError(ValueError):
    pass


def checked_address(street: str, city: str, state: str, zip_code: str = "") -> dict[str, str]:
    fields = {"streetAddress": street, "city": city, "state": state.upper().strip()}
    if fields["state"] not in ALLOWED_STATES:
        raise USPSAdapterError("Only IN, IL and KY addresses are supported")
    for key in ("streetAddress", "city"):
        if not isinstance(fields[key], str) or not SAFE_TEXT.fullmatch(fields[key].strip()):
            raise USPSAdapterError("Address contains invalid or oversized fields")
        fields[key] = fields[key].strip()
    if zip_code:
        if not re.fullmatch(r"\d{5}", zip_code):
            raise USPSAdapterError("ZIP must contain exactly five digits")
        fields["ZIPCode"] = zip_code
    return fields


def require_entitlement(env: dict[str, str]) -> tuple[str, str]:
    if env.get("TSM_USPS_ADDRESSES_ENABLED") != "1":
        raise USPSAdapterError("USPS connector disabled (default)")
    if env.get("TSM_USPS_LICENSE_APPROVED") != "1":
        raise USPSAdapterError("USPS Addresses license not explicitly approved")
    client_id = env.get("TSM_USPS_CLIENT_ID", "")
    client_secret = env.get("TSM_USPS_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        raise USPSAdapterError("USPS server-side credentials not configured")
    return client_id, client_secret


def _read_json(response, limit=131072) -> dict:
    data = response.read(limit + 1)
    if len(data) > limit:
        raise USPSAdapterError("USPS response too large")
    try:
        value = json.loads(data.decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as exc:
        raise USPSAdapterError("Unexpected USPS response format") from exc
    if not isinstance(value, dict):
        raise USPSAdapterError("Unexpected USPS response object")
    return value


def _request(req: Request, *, opener, timeout: int) -> dict:
    parsed = urlparse(req.full_url)
    if parsed.scheme != "https" or parsed.hostname != "apis.usps.com":
        raise USPSAdapterError("Invalid USPS API endpoint")
    try:
        return _read_json(opener(req, timeout=timeout))
    except HTTPError as exc:
        # Never include raw USPS error bodies: they may contain address PII.
        raise USPSAdapterError(f"USPS HTTP request failed: {exc.code}") from None
    except (URLError, TimeoutError, OSError):
        raise USPSAdapterError("USPS request unavailable") from None


def standardize(street: str, city: str, state: str, zip_code: str = "",
                *, env=None, opener=urlopen, timeout: int = 12) -> dict:
    """One on-demand lookup. Not a bulk-address harvester or a geocoder."""
    env = os.environ if env is None else env
    client_id, client_secret = require_entitlement(env)
    params = checked_address(street, city, state, zip_code)
    if timeout < 1 or timeout > 30:
        raise USPSAdapterError("Invalid network timeout")
    body = json.dumps({"grant_type": "client_credentials",
                       "client_id": client_id, "client_secret": client_secret}).encode("utf-8")
    token_req = Request(TOKEN_ENDPOINT, data=body, method="POST", headers={
        "Content-Type": "application/json", "Accept": "application/json",
        "User-Agent": "TSM-PostalAdapter/1.0"})
    token_response = _request(token_req, opener=opener, timeout=timeout)
    token = token_response.get("access_token")
    if not isinstance(token, str) or not token:
        raise USPSAdapterError("USPS OAuth token unavailable")
    url = ADDRESS_ENDPOINT + "?" + urlencode(params)
    address_req = Request(url, method="GET", headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/json", "User-Agent": "TSM-PostalAdapter/1.0"})
    payload = _request(address_req, opener=opener, timeout=timeout)
    normalized = payload.get("address")
    if not isinstance(normalized, dict):
        raise USPSAdapterError("USPS address result missing")
    # Return only the postal fields needed for matching. Never retain USPS
    # delivery-point, recipient, carrier, private-occupancy or route attributes.
    selected = {}
    for key in ("streetAddress", "secondaryAddress", "city", "state", "ZIPCode", "ZIPPlus4"):
        value = normalized.get(key)
        if value is not None:
            if not isinstance(value, str):
                raise USPSAdapterError("Invalid USPS standardized address field")
            selected[key] = value
    if selected.get("state") not in ALLOWED_STATES or not selected.get("streetAddress"):
        raise USPSAdapterError("USPS response outside requested service region")
    return {
        "schema": "tsm.postal-standardization.v1",
        "authority": "USPS_POSTAL_ONLY",
        "source_endpoint": ADDRESS_ENDPOINT,
        "status": "POSTAL_STANDARDIZED_UNLINKED",
        "address": selected,
        "parcel_link_verified": False,
        "survey_coordinate_verified": False,
        "engineering_use": False,
        "regulatory_use": False,
        "cache_persisted": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--street", required=True)
    parser.add_argument("--city", required=True)
    parser.add_argument("--state", required=True, choices=sorted(ALLOWED_STATES))
    parser.add_argument("--zip", default="")
    args = parser.parse_args()
    try:
        result = standardize(args.street, args.city, args.state, args.zip)
    except USPSAdapterError as exc:
        parser.exit(2, f"USPS adapter unavailable: {exc}\n")
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
