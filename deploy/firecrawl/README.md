# Firecrawl self-hosted sidecar

Web-scrape/HTML→Markdown service (AGPL-3.0, FirecrawlHQ/firecrawl) run as an
arms-length HTTP service for the twin's data-acquisition tooling.

## License boundary (important)

The Firecrawl server is **AGPL-3.0**. It runs only as a separate container
talked to over HTTP — a service boundary. No Firecrawl server code is
vendored into, linked against, or copied into the twin. AGPL §13 applies to
the service itself, not to clients calling its API.

What *is* vendored: the MIT-licensed Python SDK
(`scripts/vendor/firecrawl-python-sdk/`, with `LICENSE-MIT`), which the
twin's tooling uses via `scripts/vendor/tsm_firecrawl.py`.

## Run

```sh
cd deploy/firecrawl
cp .env.example .env
docker compose up -d
# API at http://localhost:3002 — no key needed (USE_DB_AUTHENTICATION=false)
```

Python:

```python
from tsm_firecrawl import scrape_markdown
md = scrape_markdown("https://example.gov/open-data-page")
```

## Legitimate-use limits

- Public / open-data pages, HTML→Markdown conversion, and self-hosted
  SearXNG search only.
- Scraping ToS-restricted sources stays prohibited regardless of tooling.
- Robots handling is the operator's responsibility (self-host compliance is
  opt-in upstream).
- Prefer official APIs and ArcGIS FeatureServers over scraping presentation
  HTML wherever one exists — this service is the fallback, not the default.

## What self-host lacks vs. Firecrawl Cloud

The proprietary Fire engine is not in the self-host stack, so JS-heavy or
bot-protected sites may fail. That is acceptable: the twin's acquisition
targets are public open-data endpoints.

## USB staging

All images are prebuilt (`ghcr.io/firecrawl/*`, `redis:alpine`) — pull once
on a networked machine, `docker save` to the USB image, `docker load` on
the air-gapped host. No build step required at deploy time.
