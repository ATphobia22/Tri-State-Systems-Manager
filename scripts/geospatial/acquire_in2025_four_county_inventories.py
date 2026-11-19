#!/usr/bin/env python3
"""Acquire byte-identical official IGIO 2025 imagery/DSM CSV indexes for four counties.

Only index CSVs are downloaded. An index is NOT tile acquisition, county coverage,
vertical-datum proof, or engineering acceptance. Data bytes remain bounded and
all external download URLs are restricted to enumerated public government S3 keys.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

COUNTIES = {"Posey": "18129", "Gibson": "18051", "Vanderburgh": "18163", "Warrick": "18173"}
INDEX_HOST = "gisimageryleafoningov.s3.amazonaws.com"
PRODUCTS = {
    "imagery": {"folder": "tif", "suffix": "tif", "header": "url_tif",
                "host": INDEX_HOST, "path": "/imageryoptimized/2025/SPW/06in/"},
    "dsm": {"folder": "dsm", "suffix": "dsm", "header": "url_dsm",
            "host": "giselevationingov.s3.amazonaws.com", "path": "/dsmoptimized/statewide/2025/SPW/1ft/"},
}
TILE_STEM = re.compile(r"in2025_[0-9]{8}_06")
MAX_CSV_BYTES = 2_000_000


def inventory_url(county: str, product: str) -> str:
    if county not in COUNTIES or product not in PRODUCTS:
        raise ValueError("COUNTY_OR_PRODUCT_NOT_ALLOWLISTED")
    definition = PRODUCTS[product]
    return f"https://{INDEX_HOST}/scripts/2025/{definition['folder']}/{county}2025{definition['suffix']}.csv"


def validate_inventory(product: str, data: bytes) -> dict:
    if product not in PRODUCTS:
        raise ValueError("PRODUCT_NOT_ALLOWLISTED")
    if not (0 < len(data) <= MAX_CSV_BYTES):
        raise ValueError("INVENTORY_EMPTY_OR_OVERSIZED")
    definition = PRODUCTS[product]
    try:
        rows = csv.reader(io.StringIO(data.decode("utf-8-sig"), newline=""))
        header = next(rows, None)
    except UnicodeDecodeError as exc:
        raise ValueError("INVENTORY_INVALID_ENCODING") from exc
    if header != [definition["header"]]:
        raise ValueError("INVENTORY_HEADER_MISMATCH")
    extensions: dict[str, set[str]] = {}
    unique_urls: set[str] = set()
    count = 0
    for row in rows:
        if len(row) != 1 or not row[0].strip():
            raise ValueError("INVENTORY_MALFORMED_ROW")
        url = row[0].strip()
        parsed = urlparse(url)
        if (parsed.scheme != "https" or parsed.hostname != definition["host"]
                or parsed.port is not None or parsed.username or parsed.password
                or parsed.query or parsed.fragment or "%" in parsed.path
                or ".." in parsed.path.split("/")
                or not parsed.path.startswith(definition["path"])):
            raise ValueError("INVENTORY_UNTRUSTED_URL")
        filename = parsed.path.split("/")[-1]
        stem, dot, extension = filename.rpartition(".")
        if not dot or not TILE_STEM.fullmatch(stem) or extension not in (
            ("tif", "tfw") if product == "imagery" else ("tif",)
        ):
            raise ValueError("INVENTORY_UNTRUSTED_EXTENSION_OR_TILE")
        if url in unique_urls or extension in extensions.get(stem, set()):
            raise ValueError("INVENTORY_DUPLICATE_URL_OR_TILE")
        unique_urls.add(url)
        extensions.setdefault(stem, set()).add(extension)
        count += 1
        if count > 20000:
            raise ValueError("INVENTORY_ROW_LIMIT_EXCEEDED")
    if not extensions:
        raise ValueError("INVENTORY_EMPTY")
    if any("tif" not in found for found in extensions.values()):
        raise ValueError("WORLD_FILE_WITHOUT_MATCHING_TIFF")
    if product == "imagery" and any(found != {"tif", "tfw"} for found in extensions.values()):
        raise ValueError("WORLD_FILE_OR_TIFF_MISSING")
    return {"tile_stems": set(extensions), "tif_count": len(extensions),
            "worldfile_count": sum("tfw" in found for found in extensions.values()),
            "source_rows": count}


def require_paired_tile_sets(image: dict, dsm: dict) -> int:
    if image["tile_stems"] != dsm["tile_stems"]:
        raise ValueError("COUNTY_IMAGERY_DSM_TILE_SET_DIVERGENCE")
    return len(image["tile_stems"])


def fetch_inventory(url: str, path: Path, *, limit: int = MAX_CSV_BYTES) -> dict:
    if url not in {inventory_url(c, p) for c in COUNTIES for p in PRODUCTS}:
        raise ValueError("INDEX_URL_NOT_ALLOWLISTED")
    if not 1 <= limit <= MAX_CSV_BYTES:
        raise ValueError("INVALID_SIZE_BUDGET")
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix=".igio-", suffix=".part", dir=path.parent)
    os.close(fd)
    temporary = Path(temporary_name)
    total = 0
    digest = hashlib.sha256()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "TSM-Official-County-Inventories/1.0"})
        with urllib.request.urlopen(req, timeout=60) as response:
            if response.geturl() != url:
                raise ValueError("INDEX_REDIRECT_OUTSIDE_EXACT_OFFICIAL_URL")
            declared = response.headers.get("Content-Length")
            if declared and int(declared) > limit:
                raise ValueError("INDEX_EXCEEDS_SIZE_BUDGET")
            etag = response.headers.get("ETag")
            last_modified = response.headers.get("Last-Modified")
            with temporary.open("wb") as target:
                while True:
                    block = response.read(1024 * 256)
                    if not block:
                        break
                    total += len(block)
                    if total > limit:
                        raise ValueError("INDEX_EXCEEDS_SIZE_BUDGET")
                    target.write(block)
                    digest.update(block)
        if declared and total != int(declared):
            raise ValueError("INDEX_CONTENT_LENGTH_MISMATCH")
        if total == 0:
            raise ValueError("INDEX_EMPTY")
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
    return {"source_url": url, "bytes": total, "sha256": digest.hexdigest(),
            "etag": etag, "last_modified": last_modified}


def acquire(output: Path, counties: list[str]) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    entries: list[dict] = []
    sha_lines: list[str] = []
    for county in counties:
        products = {}
        infos = {}
        for product in PRODUCTS:
            relative = f"in-{COUNTIES[county]}-{county.lower()}/{product}-2025-inventory.csv"
            path = output / relative
            receipt = fetch_inventory(inventory_url(county, product), path)
            info = validate_inventory(product, path.read_bytes())
            receipt.update({"product": product, "path": relative,
                            "tif_count": info["tif_count"],
                            "worldfile_count": info["worldfile_count"],
                            "source_rows": info["source_rows"]})
            products[product] = receipt
            infos[product] = info
            sha_lines.append(f"{receipt['sha256']}  {relative}\n")
        count = require_paired_tile_sets(infos["imagery"], infos["dsm"])
        entries.append({"county": county, "county_fips": COUNTIES[county],
                        "paired_tile_inventory_count": count,
                        "inventory_tile_sets_agree": True,
                        "products": products,
                        "terrain_evidence": "DSM_IS_NOT_BARE_EARTH_DEM",
                        "full_county_coverage_verified": False,
                        "vertical_datum_verified": False,
                        "all_tiles_downloaded": False})
    result = {
        "schema": "tsm.igio-2025-four-county-catalog-receipt.v1",
        "publisher": "Indiana Geographic Information Office",
        "source_authority": "https://www.in.gov/gis/geoinsights/posts/indiana-leafoff-and-leaf-on-imagery-updates",
        "license": "CC0 per official Indiana GIO AWS open-data registry",
        "source_year": 2025,
        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
        "receipt_status": "OFFICIAL_INDEX_BYTES_DOWNLOADED_AND_SHA256_VERIFIED",
        "tile_download_status": "NOT_DOWNLOADED_BY_THIS_WORKFLOW",
        "engineering_certification": False,
        "entries": entries,
    }
    (output / "SHA256SUMS.txt").write_text("".join(sha_lines), encoding="utf-8")
    (output / "acquisition-receipt.json").write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return result


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--output", type=Path, default=Path("in2025-four-county-official"))
    p.add_argument("--county", action="append", choices=sorted(COUNTIES))
    args = p.parse_args()
    counties = list(dict.fromkeys(args.county)) if args.county else list(COUNTIES)
    results = acquire(args.output, counties)
    print(json.dumps({"status": results["receipt_status"],
        "county_count": len(results["entries"]),
        "paired_tile_inventory_total": sum(x["paired_tile_inventory_count"] for x in results["entries"]),
        "all_tiles_downloaded": False}, sort_keys=True))


if __name__ == "__main__":
    main()
