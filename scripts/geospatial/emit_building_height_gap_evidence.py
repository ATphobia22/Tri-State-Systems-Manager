#!/usr/bin/env python3
"""Emit provenance-safe, coordinate-redacted 3D-building height-gap evidence.

A missing height is not filled from storeys, neighboring roofs, or NSI models.
Only literal source OBJECTIDs, closed reason classes, SHA-256 pins, and counts
leave this artifact. The input geometry and private properties are never emitted.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path

EXPECTED_COUNT = 23082
ID_KEYS = ("igioObjectId", "sourceObjectId", "objectid", "OBJECTID")
VALID_PROVENANCE = frozenset(("OBSERVED", "DERIVED"))


class EvidenceError(ValueError):
    """The input is not safe to use for source-linked diagnostics."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def source_id(properties: dict) -> int:
    candidates = []
    for key in ID_KEYS:
        value = properties.get(key)
        if value is None:
            continue
        if type(value) is not int or value < 0:
            raise EvidenceError("A source identity is not a nonnegative integer")
        candidates.append(value)
    if not candidates or len(set(candidates)) != 1:
        raise EvidenceError("Missing or conflicting IGIO source identities")
    return candidates[0]


def reason_code(raw: object) -> str:
    """Return a closed reason vocabulary; do not expose source error strings."""
    if not isinstance(raw, str):
        return "STATUS_MISSING"
    value = raw.lower().strip()
    if value == "ok":
        return "OK"
    if value.startswith("insufficient-roof-points:"):
        return "INSUFFICIENT_ROOF_RETURNS"
    if value.startswith("insufficient-ground-points:"):
        return "INSUFFICIENT_GROUND_RETURNS"
    if value.startswith("tree-confound-unreliable:"):
        return "ROOF_RETURNS_TREE_CONFOUNDED"
    if value.startswith("implausible-height:"):
        return "HEIGHT_OUT_OF_PLAUSIBLE_RANGE"
    if value == "no-points-in-buffer":
        return "NO_LIDAR_RETURNS_NEAR_FOOTPRINT"
    if value.startswith("error:tile-read-failed:"):
        return "TILE_READ_ERROR"
    if value.startswith("error:footprint-crs:"):
        return "FOOTPRINT_COORDINATE_ERROR"
    if value in ("unavailable", "unknown", "not-available"):
        return "UNAVAILABLE_UNCLASSIFIED"
    return "OTHER_UNAVAILABLE"


def valid_height(value: object) -> bool:
    return (type(value) in (int, float) and math.isfinite(value)
            and 0 < float(value) <= 328)


def evidence(
    source: Path, *,
    expected_count: int = EXPECTED_COUNT,
    identity_delta: Path | None = None,
) -> dict:
    if type(expected_count) is not int or expected_count < 1:
        raise EvidenceError("expected_count must be a positive integer")
    with source.open("r", encoding="utf-8") as stream:
        doc = json.load(stream)
    features = doc.get("features") if isinstance(doc, dict) else None
    if not isinstance(features, list) or len(features) != expected_count:
        raise EvidenceError("Feature inventory count mismatch")
    source_ids: set[int] = set()
    counts = Counter()
    ground = Counter()
    issues = []
    for feature in features:
        if not isinstance(feature, dict) or not isinstance(feature.get("properties"), dict):
            raise EvidenceError("Invalid GeoJSON feature record")
        props = feature["properties"]
        oid = source_id(props)
        if oid in source_ids:
            raise EvidenceError("Duplicate authoritative source identity")
        source_ids.add(oid)
        state = reason_code(props.get("lidarHeightStatus"))
        provenance = props.get("heightProvenance")
        has_height = valid_height(props.get("lidarHeightFt"))
        if state == "OK":
            if not has_height or provenance not in VALID_PROVENANCE:
                raise EvidenceError("OK height record lacks valid source-linked measurement")
            counts[provenance] += 1
        else:
            if provenance in VALID_PROVENANCE and has_height:
                raise EvidenceError("Unavailable height record conflicts with successful provenance")
            counts["UNAVAILABLE"] += 1
            counts[f"reason:{state}"] += 1

        coverage = props.get("elevationCoverage")
        sample_count = props.get("groundElevationSampleCount")
        if coverage == "UNAVAILABLE" or sample_count == 0:
            terrain = "DEM_UNAVAILABLE"
            ground["DEM_UNAVAILABLE"] += 1
        elif coverage == "SAMPLED" and type(sample_count) is int and sample_count > 0:
            terrain = "DEM_SAMPLED"
            ground["DEM_SAMPLED"] += 1
        else:
            terrain = "DEM_COVERAGE_UNVERIFIED"
            ground["DEM_COVERAGE_UNVERIFIED"] += 1
        if state != "OK" or terrain != "DEM_SAMPLED":
            issues.append({
                "sourceObjectId": oid,
                "heightStatus": state,
                "heightProvenance": provenance if state == "OK" else "UNAVAILABLE",
                "terrainStatus": terrain,
            })
    if len(source_ids) != expected_count:
        raise EvidenceError("OBJECTID coverage differs from expected inventory")

    delta_sha = None
    missing_published_ids: list[int] = []
    if identity_delta is not None:
        with identity_delta.open("r", encoding="utf-8") as stream:
            delta = json.load(stream)
        missing = delta.get("missingAuthoritativeObjectIds")
        if not isinstance(missing, list):
            raise EvidenceError("Published identity-delta missing authoritative ID list")
        if any(type(x) is not int for x in missing) or len(missing) != len(set(missing)):
            raise EvidenceError("Invalid or duplicate published missing OBJECTIDs")
        if not set(missing).issubset(source_ids):
            raise EvidenceError("Published identity delta contains IDs absent from source")
        if delta.get("authoritative", {}).get("count") != expected_count:
            raise EvidenceError("Published source-count evidence differs from source inventory")
        missing_published_ids = sorted(missing)
        delta_sha = sha256_file(identity_delta)
    missing_published_set = set(missing_published_ids)
    for entry in issues:
        if entry["sourceObjectId"] in missing_published_set:
            entry["missingFromPreviouslyPublishedGeometry"] = True
    issues.sort(key=lambda entry: entry["sourceObjectId"])
    missing_height_ids = [e["sourceObjectId"] for e in issues if e["heightStatus"] != "OK"]
    return {
        "schemaVersion": "tsm.building-height-gap-evidence.v1",
        "classification": "INFORMATIONAL_ONLY",
        "engineeringUse": False,
        "regulatoryUse": False,
        "completeBuildingAcceptance": counts["UNAVAILABLE"] == 0
            and ground["DEM_UNAVAILABLE"] == 0
            and ground["DEM_COVERAGE_UNVERIFIED"] == 0,
        "inputSha256": sha256_file(source),
        "identityDeltaSha256": delta_sha,
        "expectedCount": expected_count,
        "sourceIdentityCount": len(source_ids),
        "observedHeights": counts["OBSERVED"],
        "derivedHeights": counts["DERIVED"],
        "unavailableHeights": counts["UNAVAILABLE"],
        "heightReasons": dict(sorted(
            (key.removeprefix("reason:"), val)
            for key, val in counts.items() if key.startswith("reason:"))),
        "groundCoverage": dict(sorted(ground.items())),
        "missingPreviouslyPublishedGeometryCount": len(missing_published_ids),
        "missingPreviouslyPublishedObjectIds": missing_published_ids,
        "unavailableHeightObjectIds": missing_height_ids,
        "reviewQueue": issues,
        "recordDisclaimer": (
            "Per-OBJECTID diagnostic only; valid heights do not certify individual "
            "footprint topology, absolute vertical transformations, meshes, or 3D Tiles. "
            "NSI modeled building heights are not accepted LiDAR measurements."
        ),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--geojson", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--expected-count", type=int, default=EXPECTED_COUNT)
    ap.add_argument("--identity-delta", type=Path)
    args = ap.parse_args()
    try:
        paths = [args.geojson, args.out]
        if args.identity_delta is not None:
            paths.append(args.identity_delta)
        if len(set(path.resolve() for path in paths)) != len(paths):
            raise EvidenceError("Output must not overwrite input")
        if args.out.exists() or args.out.with_suffix(args.out.suffix + ".sha256").exists():
            raise EvidenceError("Refusing to overwrite existing evidence")
        receipt = evidence(args.geojson, expected_count=args.expected_count,
                           identity_delta=args.identity_delta)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        serialized = json.dumps(receipt, sort_keys=True, indent=2) + "\n"
        args.out.write_text(serialized, encoding="utf-8")
        digest = sha256_file(args.out)
        sidecar = args.out.with_suffix(args.out.suffix + ".sha256")
        sidecar.write_text(f"{digest}  {args.out.name}\n", encoding="utf-8")
        print(json.dumps({
            "total": receipt["sourceIdentityCount"],
            "observed": receipt["observedHeights"],
            "derived": receipt["derivedHeights"],
            "unavailable": receipt["unavailableHeights"],
            "reasonCounts": receipt["heightReasons"],
            "terrain": receipt["groundCoverage"],
        }, sort_keys=True))
        return 0
    except (OSError, ValueError, KeyError, TypeError) as exc:
        # Source paths/error strings may contain sensitive metadata.
        print("Height-gap evidence rejected: " + type(exc).__name__)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
