#!/usr/bin/env python3
"""TSM Government Data Contract Foundry: advisory-only source change analysis.

Compares two local catalog snapshots. No network, no dataset download, no
regulatory certification and no changes to native/runtime release gates.
Compatible with data/schemas/tsm-indiana-data-catalog-v1.json ('sources').
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA = "tsm.government.source-contract-impact.v1"
UNKNOWN = {"", "UNKNOWN", "UNVERIFIED", "NOT_EVIDENCED", "SERVICE_METADATA_REQUIRED"}
FIELD_PATHS: dict[str, tuple[str, ...]] = {
    "name": ("name", "title"),
    "agency": ("owner", "agency", "source_authority"),
    "service_url": ("url", "source_uri", "service_url", "authoritative_source.uri"),
    "service_layer_id": ("layer_id", "layerId", "service_layer_id", "source_identifier"),
    "source_version": ("version", "source_version", "schema_version"),
    "status": ("status", "verification_status", "validation_status"),
    "geographic_coverage": ("geographic_coverage", "coverage", "spatial_extent.description"),
    "horizontal_crs": ("crs", "horizontal_crs", "spatial_reference.horizontal_crs"),
    "vertical_datum": ("verticalDatum", "vertical_datum", "vertical_reference.vertical_datum"),
    "units": ("units", "spatial_reference.units", "vertical_reference.units"),
    "acquired_at": ("acquisition_date", "acquisitionDate", "acquired_at"),
    "published_at": ("publication_date", "publicationDate", "published_at"),
    "retrieved_at": ("retrieval_time", "retrieved_at", "retrievedAt"),
    "checksum_sha256": ("checksum_sha256", "sha256", "content_hash_sha256"),
}
JOIN_FIELDS = {"service_url", "service_layer_id", "geographic_coverage",
               "horizontal_crs", "vertical_datum", "units"}
SOURCE_FIELDS = {"name", "agency", "source_version", "status",
                 "acquired_at", "published_at", "retrieved_at", "checksum_sha256"}


def _field(row: dict[str, Any], alternatives: tuple[str, ...]) -> Any:
    for path in alternatives:
        value: Any = row
        present = True
        for part in path.split("."):
            if not isinstance(value, dict) or part not in value:
                present = False
                break
            value = value[part]
        # An explicit null is evidence of unknown data, never replaced
        # by another alias or a guessed default.
        if present:
            return value
    return None


def _normalized(row: dict[str, Any]) -> dict[str, Any]:
    return {name: _field(row, aliases) for name, aliases in FIELD_PATHS.items()}


def _index(document: Any) -> tuple[dict[str, dict[str, Any]], list[str]]:
    if not isinstance(document, dict) or not isinstance(document.get("sources"), list):
        raise ValueError("Expected a catalog object containing a sources list")
    result: dict[str, dict[str, Any]] = {}
    issues: list[str] = []
    for i, row in enumerate(document["sources"]):
        if not isinstance(row, dict):
            issues.append(f"source[{i}] is not an object")
            continue
        source_id = row.get("id")
        if not isinstance(source_id, str) or not source_id.strip():
            issues.append(f"source[{i}] has no stable id")
            continue
        if source_id in result:
            issues.append(f"duplicate source id: {source_id}")
            continue
        result[source_id] = _normalized(row)
    return result, issues


def _severity(field: str) -> tuple[str, list[str]]:
    if field in JOIN_FIELDS:
        return "REVIEW_REQUIRED", ["parcel_to_terrain_join", "source_geometry_alignment"]
    if field in SOURCE_FIELDS:
        return "REVIEW_RECOMMENDED", ["source_provenance", "source_freshness"]
    return "INFORMATIONAL", []


def _uncertainties(catalog: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Report explicit unknown metadata only, not absent optional fields."""
    gaps: list[dict[str, Any]] = []
    for sid, row in sorted(catalog.items()):
        for field in ("horizontal_crs", "vertical_datum", "units"):
            value = row.get(field)
            if value is None or (isinstance(value, str) and value.upper() in UNKNOWN):
                gaps.append({"source_id": sid, "field": field, "value": value,
                             "state": "NOT_EVIDENCED"})
    return gaps


def compare(
    old_document: dict[str, Any],
    new_document: dict[str, Any],
    *,
    old_sha256: str = "",
    new_sha256: str = "",
) -> dict[str, Any]:
    old, old_issues = _index(old_document)
    new, new_issues = _index(new_document)
    changes: list[dict[str, Any]] = []
    for sid in sorted(set(old) | set(new)):
        if sid not in old:
            changes.append({"source_id": sid, "kind": "ADDED", "field": None,
                            "before": None, "after": new[sid],
                            "severity": "REVIEW_RECOMMENDED",
                            "affected": ["source_registry", "downstream_adapters"]})
        elif sid not in new:
            changes.append({"source_id": sid, "kind": "REMOVED", "field": None,
                            "before": old[sid], "after": None,
                            "severity": "REVIEW_REQUIRED",
                            "affected": ["source_registry", "downstream_adapters"]})
        else:
            for field in FIELD_PATHS:
                before, after = old[sid][field], new[sid][field]
                if before != after:
                    severity, affected = _severity(field)
                    changes.append({"source_id": sid, "kind": "FIELD_CHANGED",
                                    "field": field, "before": before, "after": after,
                                    "severity": severity, "affected": affected})
    issues = [f"old: {issue}" for issue in old_issues] + [
        f"new: {issue}" for issue in new_issues
    ]
    return {
        "schema": SCHEMA,
        "comparison_state": "INCOMPLETE_INPUT" if issues else "ADVISORY_COMPARISON_ONLY",
        "release_blocking": False,
        "regulatory_certification": "NOT_EVIDENCED",
        "source_data_acquired_or_verified_by_comparison": False,
        "human_authority_final": True,
        "old_catalog_sha256": old_sha256 or None,
        "new_catalog_sha256": new_sha256 or None,
        "old_source_count": len(old),
        "new_source_count": len(new),
        "change_count": len(changes),
        "review_required_count": sum(
            row["severity"] == "REVIEW_REQUIRED" for row in changes
        ),
        "input_issues": issues,
        "changes": changes,
        "unresolved_current_metadata": _uncertainties(new),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--before", required=True, type=Path)
    parser.add_argument("--after", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        old_bytes = args.before.read_bytes()
        new_bytes = args.after.read_bytes()
        old_document = json.loads(old_bytes)
        new_document = json.loads(new_bytes)
        result = compare(old_document, new_document,
                         old_sha256=hashlib.sha256(old_bytes).hexdigest(),
                         new_sha256=hashlib.sha256(new_bytes).hexdigest())
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"Source contract analysis input error: {exc}", file=sys.stderr)
        return 2
    result["generated_utc"] = datetime.now(timezone.utc).isoformat()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n",
                           encoding="utf-8")
    print(f"TSM_SOURCE_CONTRACT_IMPACT={args.output}")
    print(f"TSM_SOURCE_CONTRACT_CHANGED={result['change_count']}")
    print("ADVISORY_ONLY: data/schema metadata comparisons do not prove ingestion.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
