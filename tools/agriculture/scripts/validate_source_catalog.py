#!/usr/bin/env python3
"""Validate authority- and licensing-aware TSM cross-sector source catalog.

Catalog entries describe candidates, not downloaded scientific evidence.
Reject implicit promotion to engineering or regulatory acceptance.
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlparse

ID = re.compile(r"^[a-z][a-z0-9.-]{2,70}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
DOMAINS = {"SURVEY", "FLOOD", "EMERGENCY", "SOIL", "CROP", "MODEL"}
TYPES = {"agency", "opensource"}


def validate_catalog(document: dict) -> list[str]:
    errors: list[str] = []
    if not isinstance(document, dict):
        return ["root must be a JSON object"]
    if document.get("schemaVersion") != "tsm.authority-agriculture-catalog.v1":
        errors.append("schema version mismatch")
    if document.get("status") != "CATALOG_ONLY" or document.get("executionStatus") != "NOT_EXECUTED":
        errors.append("source discovery must not claim an executed model or integrated live data")
    if document.get("sourceDataCaptured") is not False or document.get("humanAuthorityFinal") is not True:
        errors.append("source capture and human authority flags inconsistent")
    if not document.get("privacy"):
        errors.append("privacy policy missing")
    sources = document.get("sources")
    if not isinstance(sources, list) or not sources:
        return errors + ["non-empty source list required"]
    seen = set()
    for i, source in enumerate(sources):
        prefix = f"sources[{i}]"
        if not isinstance(source, dict):
            errors.append(prefix + ": not an object")
            continue
        name = source.get("id")
        if not isinstance(name, str) or ID.fullmatch(name) is None or name in seen:
            errors.append(prefix + ": invalid or duplicate ID")
        seen.add(name)
        if source.get("domain") not in DOMAINS or source.get("type") not in TYPES:
            errors.append(prefix + ": invalid domain or source type")
        url = source.get("url")
        if not isinstance(url, str):
            errors.append(prefix + ": missing URL")
        else:
            parsed = urlparse(url)
            if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
                errors.append(prefix + ": source URLs must be public HTTPS references without credentials")
            if parsed.hostname and parsed.hostname in {"localhost", "127.0.0.1"}:
                errors.append(prefix + ": localhost source disallowed")
            if source.get("type") == "opensource" and parsed.hostname != "github.com":
                errors.append(prefix + ": software upstream must link to its reviewed GitHub source")
            if source.get("type") == "agency" and parsed.hostname and not parsed.hostname.endswith((".gov", ".usda.gov", ".noaa.gov")):
                errors.append(prefix + ": agency source must link to an official government domain")
        if not isinstance(source.get("restriction"), str) or len(source["restriction"].strip()) < 8:
            errors.append(prefix + ": scientific/redistribution limitation missing")
        if source.get("sourceSha256") is not None and not (isinstance(source["sourceSha256"], str) and SHA256.fullmatch(source["sourceSha256"])):
            errors.append(prefix + ": invalid SHA-256 evidence")
        if source.get("integrated") is not False or source.get("engineeringUse") is not False or source.get("regulatoryUse") is not False:
            errors.append(prefix + ": catalog candidate promoted without execution evidence")
        if source.get("sourceSha256") is not None:
            errors.append(prefix + ": catalog has no downloaded source; sourceSha256 must remain null")
    if not {"SURVEY", "FLOOD", "EMERGENCY", "SOIL", "CROP", "MODEL"}.issubset({s.get("domain") for s in sources if isinstance(s, dict)}):
        errors.append("catalog missing a critical regional stakeholder/source category")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=Path("data/registries/tsm-cross-sector-source-catalog-v1.json"))
    args = parser.parse_args()
    obj = json.loads(args.catalog.read_text(encoding="utf-8"))
    errors = validate_catalog(obj)
    for error in errors:
        print("FAIL:", error)
    print("PASS: catalog only, no fabricated source status" if not errors else f"FAIL: {len(errors)} errors")
    return bool(errors)


if __name__ == "__main__":
    raise SystemExit(main())
