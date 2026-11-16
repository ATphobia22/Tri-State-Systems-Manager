#!/usr/bin/env python3
"""Bounded, read-only Federal Register search -> reproducible local evidence snapshot.

Live access is an explicit opt-in. Offline mode consumes a previously saved API JSON
response. No grants submissions, regulatory determinations, or web service are created.
Standard library only; suitable for headless CI and optional offline Windows bundles.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import date, datetime, timezone
from pathlib import Path
import tempfile
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

API = "https://www.federalregister.gov/api/v1/documents.json"
MAX_RESPONSE_BYTES = 4 * 1024 * 1024
FIELDS = (
    "document_number", "title", "type", "publication_date", "html_url",
    "pdf_url", "citation", "agency_names", "docket_id",
    "regulation_id_numbers", "effective_on", "comments_close_on",
)
TRUSTED_LINK_HOSTS = {
    "www.federalregister.gov", "federalregister.gov",
    "www.govinfo.gov", "govinfo.gov",
}
LEGAL_NOTE = (
    "FederalRegister.gov provides an informational web representation; "
    "verify legal claims against the official Federal Register edition and "
    "the controlling agency's current materials."
)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Unexpected API redirect; do not follow it")


def check_day(value: str) -> str:
    if date.fromisoformat(value).isoformat() != value:
        raise ValueError("Use ISO YYYY-MM-DD dates")
    return value


def query_url(term: str, since: str | None, until: str | None,
              page: int, per_page: int) -> str:
    if not term.strip() or len(term) > 160:
        raise ValueError("Search term must be 1..160 characters")
    if since:
        check_day(since)
    if until:
        check_day(until)
    if since and until and since > until:
        raise ValueError("Starting publication date follows ending date")
    if not 1 <= page <= 5 or not 1 <= per_page <= 100:
        raise ValueError("Pagination is outside bounded limits")
    params = [("conditions[term]", term.strip()), ("page", str(page)),
              ("per_page", str(per_page)), ("order", "newest")]
    if since:
        params.append(("conditions[publication_date][gte]", since))
    if until:
        params.append(("conditions[publication_date][lte]", until))
    params.extend(("fields[]", field) for field in FIELDS)
    return API + "?" + urlencode(params)


def fetch_api(url: str) -> bytes:
    if urlsplit(url).scheme != "https" or urlsplit(url).hostname != "www.federalregister.gov" or not url.startswith(API + "?"):
        raise ValueError("Only the fixed Federal Register API search endpoint is allowed")
    req = Request(url, headers={"Accept": "application/json",
                                "User-Agent": "TSM-Public-Evidence-Snapshot/1.0"})
    opener = build_opener(NoRedirect())
    try:
        with opener.open(req, timeout=20) as response:
            if response.status != 200:
                raise ValueError(f"API returned HTTP {response.status}")
            if "json" not in response.headers.get("Content-Type", "").lower():
                raise ValueError("API response was not JSON")
            data = response.read(MAX_RESPONSE_BYTES + 1)
    except (HTTPError, URLError) as exc:
        raise ValueError(f"Federal Register API unavailable: {exc}") from exc
    if len(data) > MAX_RESPONSE_BYTES:
        raise ValueError("API response exceeds the 4 MiB safety limit")
    return data


def official_link(value: object) -> str | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise ValueError("Expected a source URL string")
    p = urlsplit(value)
    if (p.scheme != "https" or p.hostname not in TRUSTED_LINK_HOSTS
            or p.username or p.password or p.port or p.fragment):
        raise ValueError("Untrusted document URL in source record")
    return value


def text_list(value: object) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("Expected a list of identifiers or agencies")
    return [x.strip() for x in value if isinstance(x, str) and x.strip()]


def normalize(item: object) -> dict:
    if not isinstance(item, dict):
        raise ValueError("Federal Register result must be an object")
    number = item.get("document_number")
    if not isinstance(number, str) or not number.strip() or len(number) > 128:
        raise ValueError("Document is missing a usable document_number")
    title = item.get("title")
    published = item.get("publication_date")
    if not isinstance(title, str) or not title.strip() or not isinstance(published, str):
        raise ValueError("Document title/publication date is missing")
    check_day(published)
    agencies = text_list(item.get("agency_names"))
    if not agencies and isinstance(item.get("agencies"), list):
        agencies = sorted({
            name for agency in item["agencies"] if isinstance(agency, dict)
            for name in [agency.get("name") or agency.get("raw_name")]
            if isinstance(name, str) and name.strip()
        })
    return {
        "document_number": number,
        "title": title.strip(),
        "publication_date": published,
        "type": item.get("type"),
        "agencies": sorted(set(agencies)),
        "citation": item.get("citation"),
        "docket_ids": text_list(item.get("docket_id")),
        "regulation_id_numbers": text_list(item.get("regulation_id_numbers")),
        "effective_on": item.get("effective_on"),
        "comments_close_on": item.get("comments_close_on"),
        "html_url": official_link(item.get("html_url")),
        "pdf_url": official_link(item.get("pdf_url")),
        "jurisdiction_applicability": "NOT_ASSESSED",
        "legal_review": "REQUIRED",
        "grant_opportunity_status": "NOT_ASSESSED",
    }


def parse_page(raw: bytes) -> tuple[list[dict], bool]:
    if len(raw) > MAX_RESPONSE_BYTES:
        raise ValueError("Response exceeds the 4 MiB limit")
    data = json.loads(raw)
    if not isinstance(data, dict) or not isinstance(data.get("results"), list):
        raise ValueError("Unexpected Federal Register search response shape")
    results = [normalize(item) for item in data["results"]]
    next_page = data.get("next_page_url")
    if next_page is not None and not isinstance(next_page, str):
        raise ValueError("Malformed pagination metadata")
    # Never follow next_page_url: generate only our fixed-host, bounded URLs.
    return results, bool(next_page)


def atomic_write(path: Path, raw: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".tsm-fr-", delete=False) as file:
        temp = Path(file.name)
        try:
            file.write(raw)
            file.flush()
            os.fsync(file.fileno())
        except BaseException:
            temp.unlink(missing_ok=True)
            raise
    try:
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)


def create_snapshot(raw_pages: list[tuple[str, bytes]], term: str,
                    since: str | None = None, until: str | None = None,
                    mode: str = "FIXTURE", retrieved_at: str | None = None) -> tuple[dict, list[bytes]]:
    if not raw_pages or len(raw_pages) > 5:
        raise ValueError("Expected between one and five response pages")
    seen = {}
    sources = []
    stored = []
    for index, (request_url, raw) in enumerate(raw_pages, start=1):
        documents, _has_next = parse_page(raw)
        for item in documents:
            number = item["document_number"]
            if number in seen and seen[number] != item:
                raise ValueError(f"Conflicting source metadata for {number}")
            seen[number] = item
        sources.append({
            "request_url": request_url, "file": f"page-{index:02d}.json",
            "sha256": hashlib.sha256(raw).hexdigest(),
            "record_count": len(documents),
        })
        stored.append(raw)
    ordered = sorted(seen.values(), key=lambda x: (x["publication_date"], x["document_number"]), reverse=True)
    manifest = {
        "schemaVersion": "tsm.federal-register-evidence.v1",
        "classification": "PUBLIC_REGULATORY_SOURCE_METADATA",
        "source": "National Archives FederalRegister.gov published documents API",
        "api": API,
        "mode": mode,
        "retrieved_at_utc": retrieved_at or datetime.now(timezone.utc).isoformat(),
        "search": {"term": term, "publication_date_from": since, "publication_date_to": until},
        "raw_response_files": sources,
        "documents": ordered,
        "legal_status": LEGAL_NOTE,
        "official_legal_effect_verified": False,
        "grants_opportunity_verified": False,
        "human_authority_final": True,
        "automated_filing_enabled": False,
        "spatial_coverage": "NOT_INFERRED_FROM_SEARCH_TEXT",
        "coordinate_reference_system": None,
        "vertical_datum": None,
        "units": None,
    }
    return manifest, stored


def run(args: argparse.Namespace) -> dict:
    if not 1 <= args.per_page <= 100 or not 1 <= args.max_pages <= 5:
        raise ValueError("Maximum 100 results per page and 5 pages per run")
    since = check_day(args.since) if args.since else None
    until = check_day(args.until) if args.until else None
    if since and until and since > until:
        raise ValueError("Invalid publication date range")
    if not args.term.strip() or len(args.term) > 160:
        raise ValueError("Invalid search term")
    if args.live:
        raw_pages = []
        for i in range(1, args.max_pages + 1):
            url = query_url(args.term, since, until, i, args.per_page)
            raw = fetch_api(url)
            _documents, has_next = parse_page(raw)
            raw_pages.append((url, raw))
            if not has_next:
                break
    else:
        with args.fixture.open("rb") as fixture_file:
            raw = fixture_file.read(MAX_RESPONSE_BYTES + 1)
        if len(raw) > MAX_RESPONSE_BYTES:
            raise ValueError("Offline fixture exceeds the 4 MiB safety limit")
        raw_pages = [(f"local-fixture:{args.fixture.name}", raw)]
    manifest, stored = create_snapshot(raw_pages, args.term, since, until,
                                       "LIVE" if args.live else "FIXTURE")
    out = args.output.resolve()
    folder = out.parent / (out.stem + "-raw")
    for (source, raw) in zip(manifest["raw_response_files"], stored):
        atomic_write(folder / source["file"], raw)
        source["file"] = str((folder / source["file"]).relative_to(out.parent))
    atomic_write(out, (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--live", action="store_true", help="Opt into a bounded API request (requires network)")
    group.add_argument("--fixture", type=Path, help="Read an existing saved API JSON file entirely offline")
    parser.add_argument("--term", required=True, help="Publication search term; not a legal/geographic finding")
    parser.add_argument("--since", help="Publication date YYYY-MM-DD")
    parser.add_argument("--until", help="Publication date YYYY-MM-DD")
    parser.add_argument("--per-page", type=int, default=20)
    parser.add_argument("--max-pages", type=int, default=2)
    parser.add_argument("--output", type=Path, required=True, help="Local evidence manifest JSON destination")
    args = parser.parse_args()
    try:
        result = run(args)
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        parser.error(str(exc))
    print(f"Saved {len(result['documents'])} distinct Federal Register records to {args.output}")


if __name__ == "__main__":
    main()
