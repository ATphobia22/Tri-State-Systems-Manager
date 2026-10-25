#!/usr/bin/env python3
"""Recompute and verify the 267-ID archived IGIO-to-publication delta.

The archived release is a project snapshot, not an independently certified
agency vintage. This script establishes identity and records source-geometry
presence, but cannot infer why a building was omitted or certify heights.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from reconcile_published_buildings import _identifier, reconcile


def verify_delta(published: Path, source: Path, expected: Path) -> dict:
    pin = json.loads(expected.read_text(encoding="utf-8"))
    result = reconcile(published, source, expected_count=pin["sourceFeatureCount"])
    assert pin["schemaVersion"] == "tsm.posey.archived-igio-building-id-delta.v1"
    assert result["authoritative"] is not None
    assertions = {
        "source asset SHA-256": (result["authoritative"]["sha256"], pin["sourceAssetSha256"]),
        "published asset SHA-256": (result["published"]["sha256"], pin["publishedAssetSha256"]),
        "source feature count": (result["authoritative"]["count"], pin["sourceFeatureCount"]),
        "published feature count": (result["published"]["count"], pin["publishedFeatureCount"]),
        "missing ID set": (result["missingAuthoritativeObjectIds"], pin["missingArchivedSourceObjectIds"]),
        "extra ID set": (result["publishedObjectIdsAbsentFromAuthoritative"], pin["extraPublishedObjectIds"]),
        "missing ID count": (len(result["missingAuthoritativeObjectIds"]), pin["idDifferenceCount"]),
        "source duplicates": (len(result["authoritative"]["duplicateSourceObjectIds"]), pin["sourceDuplicateIdCount"]),
        "published duplicates": (len(result["published"]["duplicateSourceObjectIds"]), pin["publishedDuplicateIdCount"]),
        "source invalid feature count": (result["authoritative"]["invalidFeatureCount"], pin["sourceInvalidFeatureCount"]),
        "published invalid feature count": (result["published"]["invalidFeatureCount"], pin["publishedInvalidFeatureCount"]),
    }
    for label, (actual, wanted) in assertions.items():
        if actual != wanted:
            raise ValueError(f"{label} differs from pinned manifest; review and regenerate against independently verified source")
    missing_ids = set(result["missingAuthoritativeObjectIds"])
    snapshot = json.loads(source.read_text(encoding="utf-8"))
    records = []
    for feature in snapshot["features"]:
        if not isinstance(feature, dict) or not isinstance(feature.get("properties"), dict):
            continue
        source_id = _identifier(feature["properties"])
        if source_id not in missing_ids:
            continue
        geometry = feature.get("geometry")
        geometry_type = geometry.get("type") if isinstance(geometry, dict) else None
        records.append({
            "sourceObjectId": source_id,
            "publicationStatus": "NOT_PUBLISHED",
            "rootCause": "UNDETERMINED",
            "sourceGeometryType": geometry_type,
            "sourceGeometryPresent": geometry_type in ("Polygon", "MultiPolygon"),
            "heightEvidenceVerified": False,
            "verticalDatumEvidenceVerified": False,
            "lodOutcomeVerified": False,
            "engineeringUse": False,
            "regulatoryUse": False,
        })
    records.sort(key=lambda item: item["sourceObjectId"])
    if [entry["sourceObjectId"] for entry in records] != result["missingAuthoritativeObjectIds"]:
        raise ValueError("Missing-ID records could not be reconstructed from the pinned source")
    return {
        "schemaVersion": "tsm.posey.archived-building-remediation.v1",
        "status": "IDENTITY_DELTA_VERIFIED_REMEDIATION_INCOMPLETE",
        "classification": "INFORMATIONAL_ONLY",
        "sourceLineageIndependentlyVerified": False,
        "engineeringUse": False,
        "regulatoryUse": False,
        "sourceSha256": result["authoritative"]["sha256"],
        "publishedSha256": result["published"]["sha256"],
        "sourceCount": result["authoritative"]["count"],
        "publishedCount": result["published"]["count"],
        "missingCount": len(records),
        "coveragePercent": result["publishedCoveragePercentAgainstExpected"],
        "missingBuildings": records,
        "warning": "Root cause, heights, NAVD88, LOD and publishable geometry are unverified; no source records were synthesized",
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--published", type=Path, required=True)
    p.add_argument("--authoritative", type=Path, required=True)
    p.add_argument("--expected", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    try:
        result = verify_delta(a.published, a.authoritative, a.expected)
    except (ValueError, OSError, KeyError, AssertionError) as exc:
        p.exit(2, f"FAIL: archived identity evidence mismatch: {exc}\n")
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Verified pinned identity delta: {result['missingCount']} missing OBJECTIDs, {result['coveragePercent']}% published; scientific remediation NOT complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
