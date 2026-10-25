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
    --expected-count 23082 --require-complete --output verified-report.json
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
    for key in ID_KEYS:
        value = props.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, int) and value >= 0:
            return value
        if isinstance(value, float) and math.isfinite(value) and value >= 0 and value.is_integer():
            return int(value)
        if isinstance(value, str) and value.strip().isdigit():
            return int(value.strip())
    return None


def _inventory(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise ValueError(f"missing GeoJSON: {path}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
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
        "sha256": _sha256(path),
        "ids": set(ids),
        "identified_count": len(ids),
        "without_id": no_id,
        "invalid_features": invalid,
        "duplicate_ids": sorted(k for k, n in counts.items() if n > 1),
    }


def reconcile(published: Path, authoritative: Path | None, expected_count: int = 23082) -> dict[str, Any]:
    if expected_count <= 0:
        raise ValueError("expected_count must be a positive integer")
    pub = _inventory(published)
    src = _inventory(authoritative) if authoritative is not None else None
    if src is not None:
        missing = sorted(src["ids"] - pub["ids"])
        extras = sorted(pub["ids"] - src["ids"])
        source_ok = (src["count"] == expected_count and src["identified_count"] == expected_count
                     and not src["duplicate_ids"] and src["invalid_features"] == 0)
        identity_ok = (pub["identified_count"] == pub["count"]
                       and not pub["duplicate_ids"] and pub["invalid_features"] == 0
                       and not missing and not extras and pub["count"] == expected_count)
        complete = bool(source_ok and identity_ok)
        status = "IDENTITY_MATCH_COUNTS_ONLY" if complete else "RECONCILIATION_INCOMPLETE"
    else:
        missing = None
        extras = None
        complete = False
        status = ("COUNT_MATCH_SOURCE_UNVERIFIED" if pub["count"] == expected_count
                  else "COUNT_GAP_SOURCE_UNVERIFIED")

    def brief(inventory: dict[str, Any]) -> dict[str, Any]:
        return {
            "count": inventory["count"],
            "sha256": inventory["sha256"],
            "identifiedCount": inventory["identified_count"],
            "missingIdentityCount": inventory["without_id"],
            "invalidFeatureCount": inventory["invalid_features"],
            "duplicateSourceObjectIds": inventory["duplicate_ids"],
        }

    return {
        "schemaVersion": "tsm.posey.building-identity-audit.v1",
        "classification": "INFORMATIONAL_ONLY",
        "regulatoryUse": False,
        "engineeringUse": False,
        "provenanceNotice": "Counts/IDs alone do not establish height, NAVD88, LOD, source vintage, or geometry accuracy",
        "status": status,
        "expectedAuthoritativeFeatureCount": expected_count,
        "published": brief(pub),
        "authoritative": brief(src) if src else None,
        "publishedCoveragePercentAgainstExpected": round(100 * pub["count"] / expected_count, 4),
        "countGapAgainstExpected": expected_count - pub["count"],
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
    parser.add_argument("--expected-count", type=int, default=23082)
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
