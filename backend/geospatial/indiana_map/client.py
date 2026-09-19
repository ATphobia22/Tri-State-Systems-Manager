"""Minimal, fail-closed IndianaMap ArcGIS REST metadata client.

Network access is intentionally limited to configured trusted hosts. The client
only retrieves service metadata; it does not execute queries or infer authority.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen

DEFAULT_ALLOWED_HOSTS = frozenset({"indianamap.org", "www.indianamap.org", "in.gov", "www.in.gov"})


@dataclass(frozen=True, slots=True)
class ServiceMetadata:
    url: str
    service_type: str
    name: str | None
    description: str | None
    spatial_reference: str | None
    raw: dict[str, Any]


def _validate_url(url: str, allowed_hosts: frozenset[str]) -> None:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme != "https" or not host:
        raise ValueError("IndianaMap service URL must use HTTPS")
    if host not in allowed_hosts:
        raise ValueError(f"untrusted IndianaMap host: {host}")


def fetch_service_metadata(
    url: str,
    *,
    timeout_seconds: float = 15.0,
    allowed_hosts: frozenset[str] = DEFAULT_ALLOWED_HOSTS,
) -> ServiceMetadata:
    """Fetch an ArcGIS REST service JSON document from a trusted host."""
    if timeout_seconds <= 0 or timeout_seconds > 120:
        raise ValueError("timeout_seconds must be > 0 and <= 120")
    _validate_url(url, allowed_hosts)
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "TSM-IndianaMap-Adapter/1.0"})
    with urlopen(request, timeout=timeout_seconds) as response:  # noqa: S310 - URL is allowlisted above.
        payload = json.load(response)
    if not isinstance(payload, dict):
        raise ValueError("ArcGIS service metadata must be a JSON object")
    service_type = payload.get("currentVersion") and "ArcGIS REST" or "unknown"
    return ServiceMetadata(
        url=url,
        service_type=service_type,
        name=payload.get("name") if isinstance(payload.get("name"), str) else None,
        description=payload.get("serviceDescription") if isinstance(payload.get("serviceDescription"), str) else None,
        spatial_reference=(payload.get("spatialReference") or {}).get("wkid") if isinstance(payload.get("spatialReference"), dict) else None,
        raw=payload,
    )
