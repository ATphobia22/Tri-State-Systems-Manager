#!/usr/bin/env python3
"""Bounded Data.gov Catalog API v4 discovery -> immutable metadata evidence.

Offline fixture replay is the default. Explicit live mode requires an operator
API key and is never used by the public/native twin runtime. No dataset downloads
or authoritative CRS/vertical-datum claims are made by this adapter.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

API = "https://api.gsa.gov/technology/datagov/v4/search"
MAX_PAGE_BYTES = 2 * 1024 * 1024
MAX_PAGES = 5
MAX_PER_PAGE = 50
MAX_CURSOR_CHARS = 1024


class CatalogError(ValueError):
    """A source, schema or safety boundary was violated."""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise CatalogError("CATALOG_REDIRECT_DISALLOWED")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def bounded_read(stream) -> bytes:
    data = stream.read(MAX_PAGE_BYTES + 1)
    if len(data) > MAX_PAGE_BYTES:
        raise CatalogError("CATALOG_PAGE_TOO_LARGE")
    return data


def parse_page(raw: bytes) -> tuple[list[dict], str | None]:
    if len(raw) > MAX_PAGE_BYTES:
        raise CatalogError("CATALOG_PAGE_TOO_LARGE")
    try:
        page = json.loads(raw)
    except (ValueError, UnicodeDecodeError) as exc:
        raise CatalogError("CATALOG_JSON_INVALID") from exc
    if not isinstance(page, dict) or not isinstance(page.get("results"), list):
        raise CatalogError("CATALOG_RESPONSE_SHAPE_INVALID")
    rows = page["results"]
    if len(rows) > MAX_PER_PAGE or any(not isinstance(item, dict) for item in rows):
        raise CatalogError("CATALOG_RESULTS_INVALID")
    after = page.get("after")
    if after is not None and (
        not isinstance(after, str) or not after
        or len(after) > MAX_CURSOR_CHARS
        or not re.fullmatch(r"[A-Za-z0-9+/_=-]+", after)
    ):
        raise CatalogError("CATALOG_CURSOR_INVALID")
    return rows, after


def build_url(query: str, per_page: int, org_type: str | None,
              spatial_filter: str | None, after: str | None) -> str:
    if not query.strip() or len(query) > 200:
        raise CatalogError("CATALOG_QUERY_INVALID")
    if per_page < 1 or per_page > MAX_PER_PAGE:
        raise CatalogError("CATALOG_PER_PAGE_OUT_OF_RANGE")
    params = {"q": query, "per_page": per_page, "sort": "relevance"}
    if org_type:
        if org_type not in {
            "Federal Government", "State Government", "County Government",
            "City Government", "Tribal", "University", "Non-Profit"
        }:
            raise CatalogError("CATALOG_ORG_TYPE_INVALID")
        params["org_type"] = org_type
    if spatial_filter:
        if spatial_filter not in {"geospatial", "non-geospatial"}:
            raise CatalogError("CATALOG_SPATIAL_FILTER_INVALID")
        params["spatial_filter"] = spatial_filter
    if after:
        if len(after) > MAX_CURSOR_CHARS or not re.fullmatch(r"[A-Za-z0-9+/_=-]+", after):
            raise CatalogError("CATALOG_CURSOR_INVALID")
        params["after"] = after
    return API + "?" + urlencode(params)


def fetch_live(url: str, api_key: str) -> bytes:
    if not api_key.strip() or api_key == "DEMO_KEY":
        raise CatalogError("CATALOG_PRODUCTION_API_KEY_REQUIRED")
    if not url.startswith(API + "?"):
        raise CatalogError("CATALOG_ENDPOINT_DISALLOWED")
    request = Request(url, headers={
        "Accept": "application/json",
        "X-Api-Key": api_key,
        "User-Agent": "TSM-Headless-Metadata-Evidence/1.0"
    })
    with build_opener(NoRedirect()).open(request, timeout=20) as response:
        return bounded_read(response)


def scalar(value):
    return value if isinstance(value, str) and value.strip() else None


def normalize_dataset(item: dict) -> dict:
    dcat = item.get("dcat") if isinstance(item.get("dcat"), dict) else {}
    org = item.get("organization") if isinstance(item.get("organization"), dict) else {}
    # A published catalog result is a discovery lead, not surveyed GIS data.
    return {
        "catalog_identifier": scalar(item.get("identifier")),
        "slug": scalar(item.get("slug")),
        "title": scalar(item.get("title")),
        "publisher": scalar(item.get("publisher")) or scalar(org.get("name")),
        "organization_type": scalar(org.get("organization_type")),
        "last_harvested_date": scalar(item.get("last_harvested_date")),
        "dataset_issued": scalar(dcat.get("issued")),
        "dataset_modified": scalar(dcat.get("modified")),
        "access_level_reported": scalar(dcat.get("accessLevel")) or scalar(item.get("accessLevel")),
        "license_claim": scalar(dcat.get("license")),
        "has_spatial_catalog_flag": item.get("has_spatial") if type(item.get("has_spatial")) is bool else None,
        "spatial_extent_claim_present": bool(item.get("spatial_shape") or dcat.get("spatial")),
        "horizontal_crs_verified": None,
        "vertical_datum_verified": None,
        "units_verified": None,
        "engineering_use": "PROHIBITED_UNTIL_SOURCE_VALIDATED",
        "jurisdiction_applicability": "NOT_ASSESSED",
        "catalog_validation_status": "UNVERIFIED_METADATA"
    }


def ingest(*, query: str, output_dir: Path, fixture_paths: list[Path] | None = None,
           live: bool = False, api_key: str = "", per_page: int = 20,
           max_pages: int = 3, org_type: str | None = None,
           spatial_filter: str | None = "geospatial") -> Path:
    if live == bool(fixture_paths):
        raise CatalogError("CATALOG_CHOOSE_LIVE_OR_FIXTURES")
    if not 1 <= max_pages <= MAX_PAGES:
        raise CatalogError("CATALOG_MAX_PAGES_OUT_OF_RANGE")
    if fixture_paths and len(fixture_paths) > max_pages:
        raise CatalogError("CATALOG_TOO_MANY_FIXTURES")
    if live and (not api_key or api_key == "DEMO_KEY"):
        raise CatalogError("CATALOG_PRODUCTION_API_KEY_REQUIRED")

    raw_pages: list[bytes] = []
    page_receipts: list[dict] = []
    candidates: list[dict] = []
    seen_records: set[str] = set()
    seen_cursors: set[str] = set()
    cursor: str | None = None
    truncated = False
    for idx in range(max_pages):
        if fixture_paths is not None and idx >= len(fixture_paths):
            truncated = cursor is not None
            break
        url = build_url(query, per_page, org_type, spatial_filter, cursor)
        if live:
            raw = fetch_live(url, api_key)
        else:
            with fixture_paths[idx].open("rb") as handle:
                raw = bounded_read(handle)
        rows, next_cursor = parse_page(raw)
        raw_pages.append(raw)
        page_receipts.append({
            "page_index": idx,
            "live_request_url": url if live else None,
            "fixture_reconstructed_query_url": None if live else url,
            "bytes": len(raw), "sha256": digest(raw), "records_returned": len(rows)
        })
        for row in rows:
            normalized = normalize_dataset(row)
            # Identifiers can be absent in autocomplete results: retain the
            # discovery row, using its canonical JSON solely for deduplication.
            identity = normalized["catalog_identifier"] or normalized["slug"] or digest(
                json.dumps(row, sort_keys=True, separators=(",", ":")).encode("utf-8"))
            if identity not in seen_records:
                seen_records.add(identity)
                candidates.append(normalized)
        if not next_cursor:
            if fixture_paths is not None and idx + 1 != len(fixture_paths):
                raise CatalogError("CATALOG_UNEXPECTED_EXTRA_FIXTURE")
            break
        if next_cursor in seen_cursors:
            raise CatalogError("CATALOG_CURSOR_LOOP")
        seen_cursors.add(next_cursor)
        cursor = next_cursor
        if idx + 1 == max_pages:
            truncated = True
    if not raw_pages:
        raise CatalogError("CATALOG_NO_PAGES")
    # Persist raw upstream bytes unchanged, with a deterministic immutable run id.
    run_key = digest(json.dumps({
        "query": query, "receipts": [p["sha256"] for p in page_receipts],
        "filter": spatial_filter, "org": org_type
    }, sort_keys=True).encode("utf-8"))[:20]
    target = output_dir / ("datagov-v4-" + run_key)
    target.mkdir(parents=True, exist_ok=False)
    try:
        for idx, raw in enumerate(raw_pages):
            (target / ("page-%03d.json" % idx)).write_bytes(raw)
        (target / "candidates.json").write_text(
            json.dumps(candidates, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        manifest = {
            "schema_version": "1.0.0",
            "source": "Data.gov Catalog API v4",
            "api_root": "https://api.gsa.gov/technology/datagov/v4/",
            "role": "DATASET_DISCOVERY_METADATA_ONLY",
            "query": query,
            "snapshot_processed_at_utc": datetime.now(timezone.utc).isoformat(),
            "source_retrieved_at_utc": datetime.now(timezone.utc).isoformat() if live else None,
            "fixture_origin_verified": False if not live else None,
            "used_live_api": live,
            "page_receipts": page_receipts,
            "candidate_count": len(candidates),
            "has_unfetched_pages": truncated,
            "candidate_sha256": digest((target / "candidates.json").read_bytes()),
            "verification_status": "UNVERIFIED_METADATA",
            "source_files_promoted_to_gis": False,
            "human_authority_final": True,
            "key_stored": False
        }
        (target / "manifest.json").write_text(
            json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        for receipt in page_receipts:
            file = target / ("page-%03d.json" % receipt["page_index"])
            if digest(file.read_bytes()) != receipt["sha256"]:
                raise CatalogError("CATALOG_DISK_HASH_MISMATCH")
        if digest((target / "candidates.json").read_bytes()) != manifest["candidate_sha256"]:
            raise CatalogError("CATALOG_DISK_HASH_MISMATCH")
        return target
    except Exception:
        shutil.rmtree(target)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--fixture", type=Path, action="append",
                      help="Existing Data.gov v4 response JSON; repeat for pages")
    mode.add_argument("--live", action="store_true", help="Explicitly fetch real metadata")
    parser.add_argument("--query", default="Wabash Ohio River flood")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--per-page", type=int, default=20)
    parser.add_argument("--max-pages", type=int, default=3)
    parser.add_argument("--org-type")
    parser.add_argument("--spatial-filter", choices=["geospatial", "non-geospatial"],
                        default="geospatial")
    args = parser.parse_args()
    try:
        target = ingest(
            query=args.query, output_dir=args.output_dir, fixture_paths=args.fixture,
            live=args.live, api_key=os.environ.get("TSM_DATAGOV_API_KEY", ""),
            per_page=args.per_page, max_pages=args.max_pages, org_type=args.org_type,
            spatial_filter=args.spatial_filter
        )
    except (CatalogError, OSError) as exc:
        parser.exit(2, "CATALOG_INGEST_FAILED: " + str(exc) + "\n")
    print(target)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
