"""
TSM self-hosted Firecrawl client.

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
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "firecrawl-python-sdk"))

from firecrawl import FirecrawlApp  # noqa: E402

DEFAULT_SELF_HOST_URL = os.environ.get(
    "TSM_FIRECRAWL_URL", "http://localhost:3002"
)


def self_hosted_client(api_url: str = DEFAULT_SELF_HOST_URL) -> FirecrawlApp:
    """Return a Firecrawl client bound to the self-hosted instance, keyless."""
    return FirecrawlApp(api_key=None, api_url=api_url)


def scrape_markdown(url: str, api_url: str = DEFAULT_SELF_HOST_URL) -> str:
    """Scrape a public URL to Markdown via the self-hosted instance."""
    client = self_hosted_client(api_url)
    result = client.scrape(url, formats=["markdown"])
    markdown = getattr(result, "markdown", None)
    if markdown is None and isinstance(result, dict):
        markdown = result.get("markdown", "")
    return markdown or ""
