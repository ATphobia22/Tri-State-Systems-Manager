"""
TSM self-hosted Firecrawl client — hardened acquisition path.

Vendored SDK: firecrawl/apps/python-sdk (MIT, Sideguide Technologies Inc.),
kept verbatim under scripts/vendor/firecrawl-python-sdk/firecrawl/.

Posture:
- Points at the SELF-HOSTED Firecrawl API (deploy/firecrawl), never at
  api.firecrawl.dev. No API key is used or needed against the self-hosted
  instance (USE_DB_AUTHENTICATION=false accepts any bearer token).
- Legitimate uses only: public/open-data pages, HTML->Markdown conversion,
  and self-hosted SearXNG search. Scraping ToS-restricted sources stays
  prohibited regardless of tooling; robots handling is the operator's
  responsibility.
- The AGPL-3.0 Firecrawl server is NEVER copied into this tree; it runs as
  an arms-length HTTP sidecar (see deploy/firecrawl/).

Security boundaries:
- SSRF guard: scrape targets must be public http(s) URLs. Private,
  loopback, link-local, multicast, and reserved IPs are rejected, as are
  non-http(s) schemes. Redirect targets are re-validated hop by hop.
  NOTE: this client-side check is defense-in-depth. The primary SSRF
  boundary is the Firecrawl sidecar's own egress policy — see
  deploy/firecrawl/README.md. Never point the sidecar at an internal
  network without an egress firewall.
- Untrusted content: everything scraped is marked trust_level="untrusted"
  with instructions_disabled=True. Web content is DATA, never instructions;
  it must not override policy, reveal secrets, or authorize tools.
- Output sanitization: secret-looking strings in scraped markdown are
  redacted before the content enters the twin.
- Provenance: every scrape carries url, timestamp, SHA-256, and provider,
  per the twin's evidence doctrine.
"""

from __future__ import annotations

import hashlib
import ipaddress
import os
import re
import socket
import sys
import time
from dataclasses import dataclass, field
from urllib.parse import urlparse, urljoin

sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), "firecrawl-python-sdk")
)

# NOTE: the vendored firecrawl import is lazy (inside self_hosted_client)
# so the SSRF guard, redaction, and envelope utilities work without the
# SDK's third-party dependencies installed.

DEFAULT_SELF_HOST_URL = os.environ.get(
    "TSM_FIRECRAWL_URL", "http://localhost:3002"
)

MAX_REDIRECTS = 5
MAX_MARKDOWN_CHARS = 500_000

_SECRET_PATTERNS = [
    re.compile(r'(?i)(api[_-]?key\s*[:=]\s*)(["\']?)[A-Za-z0-9_\-]{16,}\2'),
    re.compile(r'(?i)(secret\s*[:=]\s*)(["\']?)[A-Za-z0-9_\-]{16,}\2'),
    re.compile(r'(?i)(token\s*[:=]\s*)(["\']?)[A-Za-z0-9_\-]{20,}\2'),
    re.compile(r'(?i)(password\s*[:=]\s*)(["\']?)\S{8,}\2'),
    re.compile(r'AKIA[0-9A-Z]{16}'),  # AWS access key id
    re.compile(r'ghp_[A-Za-z0-9]{30,}'),  # GitHub PAT
    re.compile(r'xox[bap]-?[A-Za-z0-9\-]+'),  # Slack token
]


class UnsafeTargetError(ValueError):
    """Raised when a scrape target fails the SSRF guard."""


def _ips_for_host(host: str) -> list:
    """Resolve a hostname to IPs. Raises UnsafeTargetError if unresolvable."""
    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise UnsafeTargetError(f"cannot resolve scrape target host: {host}") from exc
    ips = []
    for info in infos:
        try:
            ips.append(ipaddress.ip_address(info[4][0]))
        except ValueError:
            continue
    if not ips:
        raise UnsafeTargetError(f"no usable addresses for host: {host}")
    return ips


def validate_scrape_url(url: str) -> str:
    """SSRF guard: allow only public http(s) targets. Returns normalized URL.

    Raises UnsafeTargetError on: non-http(s) scheme, missing host,
    unresolvable host, or any resolved address that is not globally
    routable (private, loopback, link-local, multicast, reserved —
    including the cloud metadata address 169.254.169.254).
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise UnsafeTargetError(f"scrape target must be http(s): {url!r}")
    host = parsed.hostname
    if not host:
        raise UnsafeTargetError(f"scrape target has no host: {url!r}")
    for ip in _ips_for_host(host):
        if not ip.is_global:
            raise UnsafeTargetError(
                f"scrape target resolves to non-public address {ip} ({host})"
            )
    return parsed.geturl()


def validate_redirect_chain(start_url: str, locations: list) -> str:
    """Re-validate each redirect hop; return the final URL.

    `locations` are the raw Location header values in order. Raises
    UnsafeTargetError if any hop is unsafe or the chain is too long.
    """
    if len(locations) > MAX_REDIRECTS:
        raise UnsafeTargetError(f"redirect chain too long ({len(locations)})")
    current = validate_scrape_url(start_url)
    for location in locations:
        current = validate_scrape_url(urljoin(current, location))
    return current


def redact_secrets(markdown: str) -> str:
    """Redact secret-looking strings from scraped content."""
    redacted = markdown
    for pattern in _SECRET_PATTERNS:
        def _repl(m: re.Match) -> str:
            prefix = m.group(1) if m.lastindex and m.lastindex >= 1 else ""
            return prefix + "[REDACTED]"
        redacted = pattern.sub(_repl, redacted)
    return redacted


@dataclass
class ScrapedDocument:
    """A scraped page with its trust and provenance envelope.

    trust_level is always "untrusted": web content is data, never
    instructions. Consumers must not let it override policy, reveal
    secrets, or authorize actions.
    """

    url: str
    markdown: str
    trust_level: str = "untrusted"
    instructions_disabled: bool = True
    retrieved_at: float = field(default_factory=time.time)
    sha256: str = ""
    provenance: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.sha256:
            self.sha256 = hashlib.sha256(self.markdown.encode("utf-8")).hexdigest()
        if not self.provenance:
            self.provenance = {
                "sourceType": "web",
                "sourceId": self.url,
                "provider": "firecrawl-selfhost",
                "retrieved_at": self.retrieved_at,
                "content_sha256": self.sha256,
                "trust_level": self.trust_level,
            }


def self_hosted_client(api_url: str = DEFAULT_SELF_HOST_URL):
    """Return a Firecrawl client bound to the self-hosted instance, keyless."""
    from firecrawl import FirecrawlApp  # lazy: keeps guard utils dependency-free

    return FirecrawlApp(api_key=None, api_url=api_url)


def scrape_document(url: str, api_url: str = DEFAULT_SELF_HOST_URL) -> ScrapedDocument:
    """Scrape a public URL to a sanitized, provenance-stamped document.

    The SSRF guard runs before any request is issued. Secrets are redacted
    from the markdown. Output is truncated to MAX_MARKDOWN_CHARS.
    """
    safe_url = validate_scrape_url(url)
    client = self_hosted_client(api_url)
    result = client.scrape(safe_url, formats=["markdown"])
    markdown = getattr(result, "markdown", None)
    if markdown is None and isinstance(result, dict):
        markdown = result.get("markdown", "")
    markdown = redact_secrets((markdown or "")[:MAX_MARKDOWN_CHARS])
    return ScrapedDocument(url=safe_url, markdown=markdown)


def scrape_markdown(url: str, api_url: str = DEFAULT_SELF_HOST_URL) -> str:
    """Scrape a public URL to sanitized Markdown (string form)."""
    return scrape_document(url, api_url).markdown
