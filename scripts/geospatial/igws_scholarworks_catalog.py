#!/usr/bin/env python3
"""Headless, provenance-only audit for an IU ScholarWorks geology bibliography.

The default command is OFFLINE and validates the checked-in source catalog.
--fetch-metadata explicitly downloads DSpace REST JSON only (never PDFs, maps,
imagery, scientific measurements, survey points or georeferenced geometry).
No citation or DSpace metadata can certify site-scale geology or legal rights.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "data/fabrics/geological/igws-scholarworks-priority-v1.json"
UUID = re.compile(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\Z")
YEAR = re.compile(r"(?:1[6-9]\d{2}|20\d{2})\Z")
RIGHTS = {"CONFLICTING_RIGHTS_METADATA", "SINGLE_NONCOMMERCIAL_NOTICE"}
APPLICABILITY = {
    "LOWER_WABASH_EXPLICIT", "POSEY_COUNTY_EXPLICIT", "NORTHERN_POSEY_EXPLICIT",
    "REGIONAL_EXTENT_REVIEW_REQUIRED", "STATEWIDE_CONTEXT_ONLY",
    "STATEWIDE_HISTORICAL_CONTEXT",
}
LIMIT = 256 * 1024


def demand(ok: bool, reason: str) -> None:
    if not ok:
        raise ValueError(reason)


def trusted_url(value: object, host: str, path_prefix: str) -> bool:
    if not isinstance(value, str):
        return False
    url = urlsplit(value)
    return (url.scheme == "https" and url.hostname == host and
            url.username is None and url.password is None and
            url.port is None and not url.query and not url.fragment and
            url.path.startswith(path_prefix))


def verify_catalog(document: dict) -> dict:
    demand(isinstance(document, dict), "Catalog must be an object")
    demand(document.get("schema") == "tsm-igws-scholarworks-priority-v1", "Unexpected catalog schema")
    demand(document.get("version") == "1.0.0", "Unexpected version")
    demand(document.get("reviewedOn") == "2026-11-16", "Expected reviewed date")
    community = document.get("sourceCommunity")
    demand(trusted_url(community, "scholarworks.iu.edu", "/dspace/communities/"), "Untrusted community URL")
    demand(community.endswith("/762d9abf-72d7-4962-818e-b1c0baf1defa"),
           "Catalog must point to the verified IU community")
    items = document.get("records")
    demand(isinstance(items, list) and len(items) >= 9, "Expected priority IGWS source records")
    ids, uuids, handles = set(), set(), set()
    for index, item in enumerate(items):
        prefix = f"record[{index}]"
        demand(isinstance(item, dict), f"{prefix}: object required")
        identifier, uuid = item.get("id"), item.get("itemId")
        demand(isinstance(identifier, str) and identifier.startswith("IGWS-") and identifier not in ids,
               f"{prefix}: duplicate/invalid record id")
        demand(isinstance(uuid, str) and UUID.fullmatch(uuid) is not None and uuid not in uuids,
               f"{prefix}: duplicate/invalid ScholarWorks item ID")
        ids.add(identifier)
        uuids.add(uuid)
        demand(item.get("sourcePage") == f"https://scholarworks.iu.edu/dspace/items/{uuid}",
               f"{prefix}: source page / ID mismatch")
        demand(item.get("metadataApi") == f"https://scholarworks.iu.edu/iuswrrest/api/core/items/{uuid}",
               f"{prefix}: metadata endpoint / ID mismatch")
        url = item.get("sourcePdfUrl")
        demand(trusted_url(url, "scholarworks.iu.edu", "/dspace/bitstreams/") and
               re.fullmatch(r"/dspace/bitstreams/[0-9a-f-]{36}/download", urlsplit(url).path) is not None,
               f"{prefix}: malformed source PDF locator")
        h = item.get("handleUri")
        demand(trusted_url(h, "hdl.handle.net", "/2022/") and
               re.fullmatch(r"/2022/\d+", urlsplit(h).path) is not None and h not in handles,
               f"{prefix}: duplicate/invalid persistent handle")
        handles.add(h)
        demand(isinstance(item.get("title"), str) and len(item["title"]) >= 8, f"{prefix}: missing title")
        demand(isinstance(item.get("authors"), list) and item["authors"] and
               all(isinstance(v, str) and v.strip() for v in item["authors"]),
               f"{prefix}: missing author")
        year = item.get("publicationYear")
        demand(type(year) is int and 1800 <= year <= 2026, f"{prefix}: invalid historical year")
        demand(isinstance(item.get("series"), str) and bool(item["series"].strip()),
               f"{prefix}: missing series")
        scale = item.get("scaleDenominator")
        demand(scale is None or (type(scale) is int and 1000 <= scale <= 1000000),
               f"{prefix}: unverified map scale")
        demand(item.get("applicability") in APPLICABILITY, f"{prefix}: invalid applicability")
        demand(item.get("rightsMetadataStatus") in RIGHTS, f"{prefix}: rights status missing")
        demand("NC" in item.get("rightsStatement", ""), f"{prefix}: noncommercial rights not recorded")
        source_rights = urlsplit(item.get("sourceRightsUri") or "")
        demand(source_rights.scheme in {"http", "https"} and
               source_rights.hostname == "creativecommons.org" and
               source_rights.path.startswith("/licenses/") and
               not source_rights.query and not source_rights.fragment,
               f"{prefix}: license metadata URI not pinned")
        demand(item.get("catalogVerification") == "ITEM_RECORD_READ_2026_11_16",
               f"{prefix}: no record-level metadata evidence")
        demand(item.get("evidenceClass") == "HISTORICAL_PUBLISHED_CONTEXT",
               f"{prefix}: publication not an observed station")
        demand(item.get("spatialDataVerification") == "NOT_GEOREFERENCED_OR_VALIDATED",
               f"{prefix}: source must not claim spatial validation")
        demand(item.get("downloadStatus") == "SOURCE_BINARY_NOT_DOWNLOADED" and
               item.get("sourceBinarySha256") is None,
               f"{prefix}: invents downloaded content or checksum")
        demand(all(item.get(field) is None for field in
                   ("sourceHorizontalCrs", "sourceVerticalDatum", "sourceCoordinateAccuracy")),
               f"{prefix}: invents geodetic metadata")
        demand(all(item.get(field) is False for field in
                   ("independentSurveyEvidence", "regulatoryUse", "publicationPdfBundlingPermitted")),
               f"{prefix}: publication cannot confer scientific/rights certification")
    return {
        "status": "PASS_METADATA_REFERENCES_ONLY",
        "catalogRecords": len(items),
        "explicitLocalHistoricalReferences": sum(
            x["applicability"] in {"POSEY_COUNTY_EXPLICIT", "NORTHERN_POSEY_EXPLICIT", "LOWER_WABASH_EXPLICIT"}
            for x in items),
        "rightsConflictsRequiringReview": sum(x["rightsMetadataStatus"] == "CONFLICTING_RIGHTS_METADATA"
                                             for x in items),
        "licensedPdfFilesDownloaded": 0,
        "surveyOrRegulatoryApprovalEstablished": False,
    }


def load_catalog(path: Path = CATALOG) -> dict:
    if path.is_symlink() or not path.is_file():
        raise ValueError("Source catalog missing or symlinked")
    data = json.loads(path.read_text(encoding="utf-8"))
    verify_catalog(data)
    return data


def get_bytes(url: str) -> bytes:
    """Bounded exact-host HTTPS retrieval. Reject redirects and oversized data."""
    request = Request(url, headers={
        "Accept": "application/json",
        "User-Agent": "Tri-State-Systems-Manager/IGWS-metadata-research (no binary downloads)",
    })
    with urlopen(request, timeout=15) as reply:
        demand(reply.geturl() == url, "Redirected DSpace metadata URL not accepted")
        data = reply.read(LIMIT + 1)
    demand(0 < len(data) <= LIMIT, "Unexpected DSpace response size")
    return data


def metadata_values(metadata: object, key: str) -> list[str]:
    if not isinstance(metadata, dict):
        return []
    value = metadata.get(key, [])
    if not isinstance(value, list):
        return []
    return [x["value"] for x in value
            if isinstance(x, dict) and isinstance(x.get("value"), str)]


def verify_dspace_item(record: dict, raw: bytes) -> dict:
    demand(isinstance(raw, bytes) and 0 < len(raw) <= LIMIT, "Missing or oversized API evidence")
    entry = json.loads(raw.decode("utf-8"))
    demand(isinstance(entry, dict), "DSpace result must be an object")
    demand(entry.get("id") == record["itemId"], "DSpace item id differs")
    demand(entry.get("handle") == urlsplit(record["handleUri"]).path.lstrip("/"),
           "DSpace handle differs")
    demand(entry.get("withdrawn") is False and entry.get("inArchive") is True,
           "DSpace record withdrawn/unarchived")
    metadata = entry.get("metadata")
    titles = metadata_values(metadata, "dc.title")
    demand(len(titles) >= 1 and titles[0].strip().casefold() == record["title"].strip().casefold(),
           "DSpace title changed; manual review required")
    years = metadata_values(metadata, "dc.date.issued")
    demand(any(str(record["publicationYear"]) == x.strip()[:4] for x in years),
           "DSpace publication year changed")
    handles = metadata_values(metadata, "dc.identifier.uri")
    demand(record["handleUri"] in handles, "DSpace persistent identifier changed")
    rights = metadata_values(metadata, "dc.rights") + metadata_values(metadata, "dc.rights.uri")
    demand(rights, "No DSpace rights metadata: human clearance required")
    demand(any("creativecommons.org" in s or "creative commons" in s.lower() for s in rights),
           "Unrecognized rights metadata: manual review required")
    # Do not turn an unresolved license discrepancy into permission to bundle PDFs.
    rights_uris = metadata_values(metadata, "dc.rights.uri")
    demand(record["sourceRightsUri"] in rights_uris,
           "DSpace rights URI changed: manual clearance is required")
    return {
        "id": record["id"],
        "source": record["metadataApi"],
        "retrievedStatus": "DSpace bibliographic metadata identity verified; rights review still required",
        "rawMetadataSha256": hashlib.sha256(raw).hexdigest(),
        "rawMetadataBytes": len(raw),
        "sourceLastModified": entry.get("lastModified"),
        "pdfDownloaded": False,
        "scientificConformance": False,
        "siteGeologyVerified": False,
        "rightsReview": record["rightsMetadataStatus"],
    }


def refresh_metadata(catalog: dict, fetch=get_bytes, metadata_dir: Path | None = None) -> dict:
    verify_catalog(catalog)
    if metadata_dir is not None:
        demand(not metadata_dir.is_symlink(), "Metadata directory must not be a symlink")
        metadata_dir.mkdir(parents=True, exist_ok=True)
    verified = []
    for record in catalog["records"]:
        payload = fetch(record["metadataApi"])
        result = verify_dspace_item(record, payload)
        verified.append(result)
        if metadata_dir is not None:
            path = metadata_dir / (record["itemId"] + ".json")
            # Never overwrite previously retrieved metadata snapshots.
            with path.open("xb") as stream:
                stream.write(payload)
    return {"status": "METADATA_ONLY_REFRESH_VERIFIED", "records": verified,
            "sourceBinaryFilesDownloaded": 0, "geospatialConformance": False}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=CATALOG)
    parser.add_argument("--fetch-metadata", action="store_true",
                        help="Explicit HTTPS download of DSpace REST JSON; NEVER PDFs")
    parser.add_argument("--save-metadata-dir", type=Path,
                        help="Optional directory for the downloaded raw DSpace JSON; requires --fetch-metadata")
    parser.add_argument("--output", type=Path, help="Optional report JSON path")
    options = parser.parse_args()
    try:
        demand(options.save_metadata_dir is None or options.fetch_metadata,
               "--save-metadata-dir requires --fetch-metadata")
        catalog = load_catalog(options.catalog)
        summary = refresh_metadata(catalog, metadata_dir=options.save_metadata_dir) \
            if options.fetch_metadata else verify_catalog(catalog)
        report = json.dumps(summary, indent=2, sort_keys=True) + "\n"
        if options.output:
            options.output.parent.mkdir(parents=True, exist_ok=True)
            options.output.write_text(report, encoding="utf-8")
        print(report, end="")
        return 0
    except (ValueError, OSError, UnicodeError, json.JSONDecodeError) as error:
        print(f"IGWS metadata gate: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
