#!/usr/bin/env python3
"""Check complete building accounting against a fresh, independently receipted IGIO snapshot.

Identity accounting is not a valid-geometry, height, texture or 3D Tiles release.
No synthetic records, heights, defaults, or approval are created.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

from reconcile_published_buildings import _identifier

STATUSES = {
    "LOD3_TEXTURED_VERIFIED", "LOD2_ROOF_RECONSTRUCTED", "LOD1_MEASURED",
    "LOD1_ESTIMATED", "FOOTPRINT_ONLY", "INSUFFICIENT_LIDAR",
    "INSUFFICIENT_IMAGERY", "INVALID_SOURCE_GEOMETRY",
    "PENDING_RECONSTRUCTION", "RECONSTRUCTION_FAILED",
}
HEIGHT_STATUSES = {
    "LOD3_TEXTURED_VERIFIED", "LOD2_ROOF_RECONSTRUCTED",
    "LOD1_MEASURED", "LOD1_ESTIMATED",
}
VALID_REVIEWS = {"PENDING", "APPROVED", "REJECTED"}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_json(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path.name} must contain a JSON object")
    return data


def source_ids(doc: dict) -> list[int]:
    if doc.get("type") != "FeatureCollection" or not isinstance(doc.get("features"), list):
        raise ValueError("source must be a GeoJSON FeatureCollection")
    ids = []
    for i, feature in enumerate(doc["features"]):
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise ValueError(f"source feature[{i}] invalid")
        props = feature.get("properties")
        sid = _identifier(props) if isinstance(props, dict) else None
        if sid is None:
            raise ValueError(f"source feature[{i}] has no unambiguous OBJECTID")
        if props.get("county") not in ("Posey", None):
            raise ValueError(f"source feature[{i}] is not in Posey County")
        geom = feature.get("geometry")
        if not isinstance(geom, dict) or geom.get("type") not in ("Polygon", "MultiPolygon"):
            raise ValueError(f"source feature[{i}] lacks a polygon footprint")
        ids.append(sid)
    if not ids or len(set(ids)) != len(ids):
        raise ValueError("source OBJECTIDs absent or duplicated")
    return ids


def validate_receipt(receipt: dict, source_sha: str, count: int) -> list[str]:
    issues = []
    if receipt.get("schema_version") != "tsm.indiana-posey-source-inventory.v1":
        issues.append("official source receipt schema missing")
    if receipt.get("source") != "https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0":
        issues.append("source URL not the official IGIO layer")
    if receipt.get("source_filter") != "county='Posey'":
        issues.append("official county filter not evidenced")
    if receipt.get("source_identity_complete") is not True:
        issues.append("official source identity gate not passed")
    if receipt.get("geometry_download_complete") is not True:
        issues.append("official geometry pages incomplete")
    if receipt.get("official_feature_count") != count:
        issues.append("source and government count disagree")
    snap = receipt.get("snapshot")
    if not isinstance(snap, dict) or snap.get("sha256") != source_sha or snap.get("identity_complete") is not True:
        issues.append("source SHA-256 or snapshot OBJECTID identity not verified")
    if not isinstance(receipt.get("source_last_edit_epoch_ms"), int):
        issues.append("official source edit/version timestamp absent")
    return issues


def account(source: Path, manifest: Path, receipt: Path | None = None) -> dict:
    """Return a deterministic audit; never modify inputs or generate missing accounts."""
    source_sha = sha256(source)
    authoritative = source_ids(load_json(source))
    src = set(authoritative)
    accounts = load_json(manifest)
    violations = []
    if accounts.get("source_sha256") != source_sha:
        violations.append("accounting manifest does not match exact authoritative source SHA-256")
    rows = accounts.get("records")
    if not isinstance(rows, list):
        raise ValueError("manifest records must be an array")
    seen = []
    status_counts = Counter()
    approved = 0
    for i, row in enumerate(rows):
        if not isinstance(row, dict):
            violations.append(f"record[{i}] is not an object")
            continue
        sid = row.get("source_objectid")
        if type(sid) is not int or sid < 0:
            violations.append(f"record[{i}] has invalid source_objectid")
            continue
        seen.append(sid)
        status = row.get("reconstruction_status")
        if status not in STATUSES:
            violations.append(f"OBJECTID {sid}: missing/invalid reconstruction_status")
        else:
            status_counts[status] += 1
        uncertainty = row.get("uncertainty")
        if not isinstance(uncertainty, dict) or not all(k in uncertainty for k in ("horizontal_m", "vertical_m", "reason")):
            violations.append(f"OBJECTID {sid}: uncertainty and reason must be explicit")
        else:
            for key in ("horizontal_m", "vertical_m"):
                val = uncertainty[key]
                if val is None:
                    if not isinstance(uncertainty["reason"], str) or not uncertainty["reason"].strip():
                        violations.append(f"OBJECTID {sid}: unknown {key} requires reason")
                elif type(val) not in (int, float) or not math.isfinite(val) or val < 0:
                    violations.append(f"OBJECTID {sid}: invalid {key}")
        review = row.get("review_status")
        if review not in VALID_REVIEWS:
            violations.append(f"OBJECTID {sid}: explicit review_status required")
        elif review == "APPROVED":
            if not isinstance(row.get("reviewer"), str) or not row["reviewer"].strip():
                violations.append(f"OBJECTID {sid}: approved record lacks human reviewer")
            else:
                approved += 1
        if row.get("is_simulated") is True or row.get("height_provenance") in ("DEFAULT", "FABRICATED", "SIMULATED"):
            violations.append(f"OBJECTID {sid}: fabricated or simulated height prohibited")
        if status in HEIGHT_STATUSES:
            evidence = row.get("measurement_evidence")
            if not isinstance(evidence, dict) or not evidence.get("method") or not evidence.get("source_sha256"):
                violations.append(f"OBJECTID {sid}: height status needs method and evidence digest")
            elif not isinstance(evidence["source_sha256"], str) or len(evidence["source_sha256"]) != 64:
                violations.append(f"OBJECTID {sid}: malformed measurement source SHA-256")
    counts = Counter(seen)
    duplicates = sorted(k for k, n in counts.items() if n > 1)
    missing = sorted(src - set(seen))
    extras = sorted(set(seen) - src)
    if duplicates:
        violations.append(f"duplicate accounting OBJECTIDs: {len(duplicates)}")
    if missing:
        violations.append(f"unaccounted authoritative OBJECTIDs: {len(missing)}")
    if extras:
        violations.append(f"non-authoritative accounting OBJECTIDs: {len(extras)}")
    source_issues = validate_receipt(load_json(receipt), source_sha, len(authoritative)) if receipt else ["fresh official source receipt missing"]
    complete = not violations and not source_issues and len(rows) == len(authoritative)
    return {
        "schemaVersion": "tsm.posey.building-acceptance.v2",
        "policyVersion": "2.0.0",
        "countyFips": "18129",
        "sourceSha256": source_sha,
        "freshAuthoritativeCount": len(authoritative),
        "accountedCount": len(rows),
        "reconciliationRatio": len(src.intersection(set(seen))) / len(src),
        "identityReconciled": complete,
        "allHumanReviewed": complete and approved == len(rows),
        "reconstructionStatuses": dict(sorted(status_counts.items())),
        "missingSourceObjectIds": missing,
        "nonAuthoritativeObjectIds": extras,
        "duplicateAccountingObjectIds": duplicates,
        "violations": violations,
        "sourceReceiptIssues": source_issues,
        "geometryAccuracyVerified": False,
        "assetChecksumsVerified": False,
        "cesiumRuntimeVerified": False,
        "offlineWindowsVerified": False,
        "full3dProductionAcceptance": False,
        "regulatoryCertification": False,
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--authoritative", type=Path, required=True)
    p.add_argument("--accounts", type=Path, required=True)
    p.add_argument("--source-receipt", type=Path)
    p.add_argument("--output", type=Path)
    p.add_argument("--require-complete", action="store_true")
    args = p.parse_args()
    try:
        report = account(args.authoritative, args.accounts, args.source_receipt)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        p.exit(2, f"ERROR: {exc}\n")
    data = json.dumps(report, sort_keys=True, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(data, encoding="utf-8")
    print(data)
    return 1 if args.require_complete and not report["identityReconciled"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
