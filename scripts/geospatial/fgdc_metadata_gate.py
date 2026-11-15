#!/usr/bin/env python3
"""Offline FGDC standards profile and legacy CSDGM source-metadata gate.

This validates descriptive metadata and evidence boundaries, not regulatory or
scientific conformance. It downloads nothing and uses only the Python stdlib.
"""

import argparse
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parents[2]
STANDARDS = "data/standards/fgdc-standards-profile-v1.json"
REGISTRY = "data/tsm-fgdc-tristate-geospatial-registry-v1.json"
CSDGM = "data/regulatory/nfhl-indiana-20260706-metadata.xml"
SHA256 = re.compile(r"[0-9a-fA-F]{64}\Z")
EPSG = re.compile(r"EPSG:[0-9]{3,6}\Z")
STATUSES = {"DISCOVERY_ONLY", "ACQUIRED_UNREVIEWED", "SOURCE_CHECKSUM_VERIFIED", "INDEPENDENTLY_REVIEWED"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def https_url(value):
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.netloc) and not parsed.username and not parsed.password


def iso_date(value):
    try:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%Y-%m-%d") == value
    except (TypeError, ValueError):
        return False


def utc_timestamp(value):
    try:
        return isinstance(value, str) and value.endswith("Z") and datetime.fromisoformat(value.replace("Z", "+00:00")).utcoffset().total_seconds() == 0
    except (TypeError, ValueError, AttributeError):
        return False


def check_profile(root):
    profile = json.loads((root / STANDARDS).read_text(encoding="utf-8"))
    require(profile.get("schema") == "tsm-fgdc-standards-profile", "Unexpected standards profile schema")
    require(profile.get("version") == "1.0.0", "Unexpected standards profile version")
    require(https_url(profile.get("catalogUrl")), "FGDC catalog URL must be HTTPS")
    require(profile.get("policy", {}).get("automaticRegulatoryCertification") is False, "Metadata cannot certify data")
    standards = profile.get("standards")
    require(isinstance(standards, list) and len(standards) >= 8, "Incomplete standards profile")
    seen = set()
    for standard in standards:
        identifier = standard.get("id")
        require(isinstance(identifier, str) and identifier not in seen, "Missing/duplicate standard identifier")
        seen.add(identifier)
        require(https_url(standard.get("url")), f"{identifier}: invalid authority URL")
        require(standard.get("status") in {"REFERENCE_ACTIVE", "LEGACY_INGEST"}, f"{identifier}: invalid status")
        require(all(isinstance(standard.get(key), str) and standard[key] for key in ("title", "version")), f"{identifier}: missing label")
        require(isinstance(standard.get("use"), list) and standard["use"], f"{identifier}: missing use cases")
    require("FGDC-STD-001-1998" in seen and "ISO-19157-1-2023" in seen and "OGC-GEOTIFF-1.1" in seen, "Missing required standards")
    return {"profileStandards": len(standards)}


def check_registry(root):
    registry = json.loads((root / REGISTRY).read_text(encoding="utf-8"))
    require(registry.get("schema") == "tsm-fgdc-tristate-geospatial-registry", "Unexpected agency registry")
    require(all(key in registry.get("tri_state", {}) for key in ("indiana", "illinois", "kentucky")), "Tri-state registry incomplete")
    require(https_url(registry.get("nfhl_layers_reference", {}).get("service")), "Missing FEMA source service")
    return {"registry": "REGISTERED_NOT_DOWNLOADED_BY_GATE"}


def check_csdgm(root):
    file = root / CSDGM
    xml = ET.parse(file).getroot()
    require(xml.tag == "metadata", "Not a CSDGM metadata root")
    standard = xml.findtext("./metainfo/metstdv")
    require(standard == "FGDC-STD-001-1998", "Unexpected FEMA metadata standard")
    publication = xml.findtext("./idinfo/citation/citeinfo/pubdate")
    require(bool(publication) and bool(re.fullmatch(r"[0-9]{8}", publication)), "Missing FEMA publication date")
    with file.open("rb") as stream:
        content_sha256 = hashlib.file_digest(stream, "sha256").hexdigest()
    return {"csdgm": "PARSED_LEGACY_SOURCE_METADATA_ONLY", "publicationDateRaw": publication, "xmlSha256": content_sha256}


def check_records(manifest, root=REPO_ROOT):
    require(manifest.get("schema") == "tsm-geospatial-source-metadata", "Unexpected source manifest schema")
    records = manifest.get("records")
    require(isinstance(records, list) and records, "Source records cannot be empty")
    for index, record in enumerate(records):
        prefix = f"records[{index}]"
        for field in ("datasetId", "name", "agency", "sourceVersion", "horizontalCrs", "verticalDatum", "units", "limitations"):
            require(isinstance(record.get(field), str) and record[field].strip(), f"{prefix}: missing {field}")
        require(https_url(record.get("sourceUri")), f"{prefix}: sourceUri must be HTTPS")
        require(bool(EPSG.fullmatch(record["horizontalCrs"])), f"{prefix}: horizontalCrs must be an explicit EPSG code")
        require(record.get("authorityClass") in {"OBSERVED_AGENCY", "DERIVED", "SCENARIO", "REFERENCE"}, f"{prefix}: authorityClass invalid")
        status = record.get("verificationStatus")
        require(status in STATUSES, f"{prefix}: verificationStatus invalid")
        if record.get("publicationDate") is not None:
            require(iso_date(record["publicationDate"]), f"{prefix}: publicationDate not ISO date")
        if status != "DISCOVERY_ONLY":
            require(utc_timestamp(record.get("retrievedAtUtc")), f"{prefix}: retrievedAtUtc missing/invalid")
            require(isinstance(record.get("contentSha256"), str) and bool(SHA256.fullmatch(record["contentSha256"])), f"{prefix}: contentSha256 missing/invalid")
            rel = record.get("localPath")
            require(isinstance(rel, str) and bool(rel.strip()), f"{prefix}: localPath required for acquired evidence")
            local = (root / rel).resolve()
            require(local.is_relative_to(root.resolve()) and local.is_file(), f"{prefix}: localPath must be an existing repository file")
            with local.open("rb") as stream:
                digest = hashlib.file_digest(stream, "sha256").hexdigest()
            require(digest.lower() == record["contentSha256"].lower(), f"{prefix}: local content SHA-256 mismatch")
        else:
            require(record.get("contentSha256") in (None, ""), f"{prefix}: discovery entries must not claim acquired hashes")
        if status == "INDEPENDENTLY_REVIEWED":
            review = record.get("independentReview", {})
            require(isinstance(review, dict) and all(review.get(k) for k in ("reviewer", "reviewedAtUtc", "evidenceUri")), f"{prefix}: review evidence required")
            require(utc_timestamp(review["reviewedAtUtc"]) and https_url(review["evidenceUri"]), f"{prefix}: independent review invalid")
        if record["verticalDatum"] == "UNKNOWN":
            require(record.get("elevationTransformPermitted") is False, f"{prefix}: unknown vertical datum must block elevation transform")
        if record.get("elevationTransformPermitted") is True:
            require(record["verticalDatum"] not in ("UNKNOWN", "NOT_APPLICABLE"), f"{prefix}: cannot transform without vertical datum")
    return {"sourceRecordsChecked": len(records)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    parser.add_argument("--manifest", type=Path, help="Optional source-metadata JSON manifest to validate")
    args = parser.parse_args(argv)
    try:
        report = {"outcome": "DESCRIPTIVE_METADATA_GATE_ONLY"}
        report.update(check_profile(args.root))
        report.update(check_registry(args.root))
        report.update(check_csdgm(args.root))
        if args.manifest:
            report.update(check_records(json.loads(args.manifest.read_text(encoding="utf-8")), args.root))
    except (OSError, ValueError, KeyError, ET.ParseError, TypeError) as exc:
        print(json.dumps({"outcome": "FAILED", "reason": str(exc)}, sort_keys=True), file=sys.stderr)
        return 1
    print(json.dumps(report, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
