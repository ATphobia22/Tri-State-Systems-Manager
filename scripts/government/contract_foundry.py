#!/usr/bin/env python3
"""Government Data Contract Foundry: compile local source metadata and drift to QA contracts.

Reuses source_contract_impact.py (including the data-plane crosswalk). Offline,
non-mutating, and advisory: a public endpoint registry does not verify source
bytes, CRSs, FEMA effective validity, or official agency authorizations.
"""
from __future__ import annotations

import argparse
from hashlib import sha256
import json
from pathlib import Path
import sys
from urllib.parse import urlsplit

try:
    from scripts.government import source_contract_impact as impact
except ModuleNotFoundError:
    import source_contract_impact as impact

SCHEMA = "tsm.government.contract-foundry.v1"
MANDATORY_REVIEW = {
    "service_url": "SOURCE_ENDPOINT_REVIEW",
    "service_layer_id": "LAYER_ID_OR_SERVICE_SCOPE_REVIEW",
    "geographic_coverage": "COVERAGE_VALIDATION",
    "horizontal_crs": "CRS_VALIDATION",
    "vertical_datum": "VERTICAL_DATUM_VALIDATION",
    "units": "UNITS_VALIDATION",
    "acquired_at": "ACQUISITION_DATE_REVIEW",
    "published_at": "PUBLICATION_DATE_REVIEW",
    "retrieved_at": "RETRIEVAL_DATE_REVIEW",
    "checksum_sha256": "DATASET_BYTES_SHA256_VALIDATION",
}
MISSING = {"", "UNKNOWN", "UNVERIFIED", "NOT_EVIDENCED", "SERVICE_METADATA_REQUIRED", "N/A"}


def _unavailable(value) -> bool:
    return value is None or (isinstance(value, str) and value.strip().upper() in MISSING)


def _safe_endpoint(value):
    if _unavailable(value):
        return None
    if not isinstance(value, str) or len(value) > 2048:
        raise ValueError("Malformed government service URL")
    parsed = urlsplit(value)
    if (parsed.scheme != "https" or not parsed.netloc or parsed.username
            or parsed.password or parsed.fragment or any(
                key in parsed.query.lower() for key in
                ("token=", "apikey=", "api_key=", "secret=", "password="))):
        raise ValueError("Source URL is not a clean public HTTPS metadata endpoint")
    return value


def compile_catalog(catalog: dict, catalog_sha256: str, *,
                    previous: dict | None = None, previous_sha256: str = "",
                    plane_map: dict | None = None, plane_map_sha256: str = "") -> dict:
    normalized, issues = impact._index(catalog)
    if issues:
        raise ValueError("Catalog has duplicate/invalid identifiers: " + "; ".join(issues))
    sources = []
    for sid, metadata in sorted(normalized.items()):
        url = _safe_endpoint(metadata["service_url"])
        checks = []
        for field, review in MANDATORY_REVIEW.items():
            if _unavailable(metadata.get(field)):
                checks.append({"field": field, "state": "NOT_EVIDENCED",
                               "requiredReview": review})
        # The existing 'VERIFIED' endpoint registration only describes the
        # catalog author's assertion, never verified downloaded bytes.
        sources.append({
            "sourceId": sid,
            "agency": metadata["agency"],
            "name": metadata["name"],
            "serviceUrl": url,
            "serviceLayerId": metadata["service_layer_id"],
            "geographicCoverage": metadata["geographic_coverage"],
            "horizontalCrs": metadata["horizontal_crs"],
            "verticalDatum": metadata["vertical_datum"],
            "units": metadata["units"],
            "acquisitionDate": metadata["acquired_at"],
            "publicationDate": metadata["published_at"],
            "retrievalTime": metadata["retrieved_at"],
            "catalogStatus": metadata["status"],
            "sourceVersion": metadata["source_version"],
            "datasetSha256Declared": metadata["checksum_sha256"],
            "sourceBytesIndependentlyVerified": False,
            "geometryAlignmentVerified": False,
            "scientificInterpretationVerified": False,
            "status": "REVIEW_REQUIRED" if checks else "METADATA_COMPLETE_SOURCE_UNVERIFIED",
            "requiredReviews": checks,
        })
    result = {
        "schema": SCHEMA,
        "classification": "INFORMATIONAL_ONLY",
        "catalogSha256": catalog_sha256,
        "catalogSourceCount": len(sources),
        "sources": sources,
        "contractChecksMissingCount": sum(len(s["requiredReviews"]) for s in sources),
        "sourceDataAcquired": False,
        "sourceDataVerifiedByCompilation": False,
        "humanAuthorityFinal": True,
        "regulatoryDetermination": False,
        "releaseBlocking": False,
        "notice": "Source catalog metadata is a registration record, not tested source data, vertical datum, FEMA determination or agency endorsement.",
    }
    if previous is not None:
        diff = impact.compare(previous, catalog, old_sha256=previous_sha256,
                              new_sha256=catalog_sha256)
        result["drift"] = diff
        if plane_map is not None:
            old_index, old_issues = impact._index(previous)
            if old_issues:
                raise ValueError("Previous catalog has invalid/duplicate source identifiers")
            result["planeImpact"] = impact.map_plane_impacts(
                diff, plane_map, set(old_index) | set(normalized))
            result["planeMapSha256"] = plane_map_sha256
    elif plane_map is not None:
        result["planeImpact"] = {
            "status": "NOT_EVALUATED_NO_PREVIOUS_CATALOG",
            "notice": "A one-time contract compilation cannot establish source drift",
        }
        result["planeMapSha256"] = plane_map_sha256
    return result


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--catalog", required=True, type=Path)
    p.add_argument("--before", type=Path)
    p.add_argument("--plane-map", type=Path)
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args(argv)
    inputs = [x for x in (args.catalog, args.before, args.plane_map) if x is not None]
    if args.output.resolve() in {x.resolve() for x in inputs}:
        p.error("Cannot replace input metadata")
    try:
        catalog, catalog_bytes = impact._read_strict_document(args.catalog)
        previous = None
        previous_digest = ""
        if args.before is not None:
            previous, previous_bytes = impact._read_strict_document(args.before)
            previous_digest = sha256(previous_bytes).hexdigest()
        plane_map = None
        plane_digest = ""
        if args.plane_map is not None:
            plane_map, plane_bytes = impact._read_strict_document(args.plane_map)
            plane_digest = sha256(plane_bytes).hexdigest()
        result = compile_catalog(
            catalog, sha256(catalog_bytes).hexdigest(),
            previous=previous, previous_sha256=previous_digest,
            plane_map=plane_map, plane_map_sha256=plane_digest)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("x", encoding="utf-8") as output:
            json.dump(result, output, ensure_ascii=False, allow_nan=False, indent=2)
            output.write("\n")
    except (ValueError, OSError, TypeError, KeyError) as exc:
        print("Contract Foundry error: " + str(exc), file=sys.stderr)
        return 2
    print(f"TSM contract foundry: {result['catalogSourceCount']} catalog sources, "
          f"{result['contractChecksMissingCount']} missing metadata checks; "
          "no external source acquisition or regulatory approval")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
