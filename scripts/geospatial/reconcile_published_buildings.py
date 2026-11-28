#!/usr/bin/env python3
"""Audit published Posey screening footprints against an authoritative feature set.

Without an authoritative source file, report only the observed cardinality gap;
a count difference is not evidence of which OBJECTIDs are missing. This script
never rewrites inputs, fabricates geometry or heights, or grants design status.

Examples:
  python scripts/geospatial/reconcile_published_buildings.py \
    --published tsm-console/public/3d-tiles/buildings-3d.json \
    --output /tmp/posey-building-audit.json
  python scripts/geospatial/reconcile_published_buildings.py \
    --published public.geojson --authoritative acquired-igio.geojson \
    --require-complete --output verified-report.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from typing import Any

ID_KEYS = ("igioObjectId", "sourceObjectId", "OBJECTID", "objectid", "source_object_id")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _identifier(props: dict[str, Any]) -> int | None:
    """Use only unambiguous source identity, even when aliases coexist.

    A feature can carry historical and normalized ID keys. Disagreement is
    an evidence error: silently choosing the first alias could hide a source
    substitution and falsely satisfy an exact OBJECTID set comparison.
    """
    candidates: dict[str, int] = {}
    for key in ID_KEYS:
        value = props.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, int) and value >= 0:
            candidates[key] = value
        elif isinstance(value, float) and math.isfinite(value) and value >= 0 and value.is_integer():
            candidates[key] = int(value)
        elif isinstance(value, str) and value.strip().isdigit():
            candidates[key] = int(value.strip())
    if len(set(candidates.values())) > 1:
        raise ValueError(f"conflicting source OBJECTID aliases: {candidates}")
    return next(iter(candidates.values()), None)


def _inventory(path: Path, *, file_bytes: bytes | None = None) -> dict[str, Any]:
    """Audit the exact byte snapshot supplied by a caller, or read once locally."""
    if not path.is_file():
        raise ValueError(f"missing GeoJSON: {path}")
    try:
        raw = file_bytes if file_bytes is not None else path.read_bytes()
        data = json.loads(raw)
    except (OSError, UnicodeError, ValueError) as exc:
        raise ValueError(f"cannot read GeoJSON {path}: {exc}") from exc
    if not isinstance(data, dict) or data.get("type") != "FeatureCollection" or not isinstance(data.get("features"), list):
        raise ValueError(f"not a GeoJSON FeatureCollection: {path}")
    features = data["features"]
    ids: list[int] = []
    no_id = 0
    invalid = 0
    for feature in features:
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            invalid += 1
            continue
        props = feature.get("properties")
        identifier = _identifier(props) if isinstance(props, dict) else None
        if identifier is None:
            no_id += 1
        else:
            ids.append(identifier)
    counts = Counter(ids)
    return {
        "count": len(features),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "ids": set(ids),
        "identified_count": len(ids),
        "without_id": no_id,
        "invalid_features": invalid,
        "duplicate_ids": sorted(k for k, n in counts.items() if n > 1),
        "sorted_identity_multiset_sha256": hashlib.sha256(
            json.dumps(sorted(ids), separators=(",", ":")).encode("utf-8")
        ).hexdigest(),
    }


def reconcile(published: Path, authoritative: Path | None, expected_count: int | None = None) -> dict[str, Any]:
    if expected_count is not None and (type(expected_count) is not int or expected_count <= 0):
        raise ValueError("expected_count must be a positive integer")
    pub = _inventory(published)
    src = _inventory(authoritative) if authoritative is not None else None
    # Only an independently supplied authoritative snapshot may determine a new
    # production count. Explicit expected_count is for retrospective audits.
    target_count = expected_count if expected_count is not None else (src["count"] if src else None)
    if src is not None:
        missing = sorted(src["ids"] - pub["ids"])
        extras = sorted(pub["ids"] - src["ids"])
        source_ok = (src["count"] == target_count and src["identified_count"] == target_count
                     and not src["duplicate_ids"] and src["invalid_features"] == 0)
        identity_ok = (pub["identified_count"] == pub["count"]
                       and not pub["duplicate_ids"] and pub["invalid_features"] == 0
                       and not missing and not extras and pub["count"] == target_count)
        complete = bool(source_ok and identity_ok)
        status = "IDENTITY_MATCH_COUNTS_ONLY" if complete else "RECONCILIATION_INCOMPLETE"
    else:
        missing = None
        extras = None
        complete = False
        status = ("AUTHORITATIVE_SOURCE_UNAVAILABLE" if target_count is None else
                  "COUNT_MATCH_SOURCE_UNVERIFIED" if pub["count"] == target_count
                  else "COUNT_GAP_SOURCE_UNVERIFIED")

    def brief(inventory: dict[str, Any]) -> dict[str, Any]:
        return {
            "count": inventory["count"],
            "sha256": inventory["sha256"],
            "identifiedCount": inventory["identified_count"],
            "missingIdentityCount": inventory["without_id"],
            "invalidFeatureCount": inventory["invalid_features"],
            "duplicateSourceObjectIds": inventory["duplicate_ids"],
            "sortedIdentityMultisetSha256": inventory["sorted_identity_multiset_sha256"],
        }

    return {
        "schemaVersion": "tsm.posey.building-identity-audit.v1",
        "classification": "INFORMATIONAL_ONLY",
        "regulatoryUse": False,
        "engineeringUse": False,
        "provenanceNotice": "Counts/IDs alone do not establish height, NAVD88, LOD, source vintage, or geometry accuracy",
        "status": status,
        "expectedAuthoritativeFeatureCount": target_count,
        "freshAuthoritativeCountDerivedFromSnapshot": src["count"] if src else None,
        "historicalExpectedCountOverride": expected_count,
        "published": brief(pub),
        "authoritative": brief(src) if src else None,
        "publishedCoveragePercentAgainstExpected": round(100 * pub["count"] / target_count, 4) if target_count else None,
        "countGapAgainstExpected": target_count - pub["count"] if target_count is not None else None,
        "missingAuthoritativeObjectIds": missing,
        "publishedObjectIdsAbsentFromAuthoritative": extras,
        "missingIdsAreUnknownWithoutAuthoritativeFile": src is None,
        "identityAndCountReconciled": complete,
        "fullEngineeringAcceptance": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--published", type=Path, required=True)
    parser.add_argument("--authoritative", type=Path)
    parser.add_argument("--expected-count", type=int, default=None,
                        help="historical retrospective override only; fresh count comes from --authoritative")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--require-complete", action="store_true",
                        help="fail if exact authoritative IDs are not present or do not reconcile")
    args = parser.parse_args()
    try:
        report = reconcile(args.published, args.authoritative, args.expected_count)
    except ValueError as exc:
        parser.exit(2, f"ERROR: {exc}\n")
    rendered = json.dumps(report, sort_keys=True, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    print(rendered)
    if args.require_complete and not report["identityAndCountReconciled"]:
        print("FAIL: exact authoritative identity reconciliation unavailable or incomplete", flush=True)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
