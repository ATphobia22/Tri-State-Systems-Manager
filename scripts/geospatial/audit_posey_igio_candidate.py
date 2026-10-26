#!/usr/bin/env python3
"""Audit a user-supplied IGIO-like Posey footprint snapshot without endorsing it.

No source geometry, coordinates, addresses, source labels or raw features are
written to the diagnostic receipt. Source geometry is never repaired here.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
from typing import Any

from shapely.geometry import shape
from shapely.validation import explain_validity

EXPECTED_COUNT = 23082
MAX_BYTES = 256 * 1024 * 1024
ALLOWED_GEOMETRY_TYPES = frozenset(("Polygon", "MultiPolygon"))
DECLARED_SOURCE = "IGIO Building_Footprints_of_Indiana_2016_2020"


class CandidateError(ValueError):
    """The supplied candidate fails inventory or input-safety checks."""


def bounded_hash(path: Path) -> tuple[str, int]:
    if not path.is_file() or path.is_symlink():
        raise CandidateError("Expected a regular, non-symlink input")
    digest, size = hashlib.sha256(), 0
    with path.open("rb") as reader:
        for block in iter(lambda: reader.read(1024 * 1024), b""):
            size += len(block)
            if size > MAX_BYTES:
                raise CandidateError("Candidate exceeds bounded input limit")
            digest.update(block)
    if not size:
        raise CandidateError("Candidate is empty")
    return digest.hexdigest(), size


def safe_reason(explanation: str) -> str:
    """GEOS explanations contain precise coordinates: discard bracketed suffix."""
    return explanation.split("[", 1)[0].strip().replace(" ", "_").upper()[:80]


def audit(path: Path, *, expected_count: int = EXPECTED_COUNT,
          expected_sha256: str | None = None) -> tuple[dict[str, Any], dict[str, Any]]:
    if type(expected_count) is not int or expected_count < 1:
        raise CandidateError("Expected count must be a positive integer")
    sha, size = bounded_hash(path)
    if expected_sha256 is not None and sha != expected_sha256.lower():
        raise CandidateError("Candidate SHA-256 does not match supplied pin")
    try:
        with path.open("r", encoding="utf-8") as stream:
            collection = json.load(stream)
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise CandidateError("Source is not UTF-8 GeoJSON") from exc
    if not isinstance(collection, dict) or collection.get("type") != "FeatureCollection":
        raise CandidateError("Expected a GeoJSON FeatureCollection")
    features = collection.get("features")
    if not isinstance(features, list) or len(features) != expected_count:
        raise CandidateError("Feature count disagrees with expected inventory")

    ids: set[int] = set()
    types: Counter[str] = Counter()
    declared_years: Counter[str] = Counter()
    declared_sources: Counter[str] = Counter()
    invalid: list[dict[str, Any]] = []
    empty: list[int] = []
    holes = heights = ground = 0
    for feature in features:
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise CandidateError("Invalid GeoJSON Feature")
        properties = feature.get("properties")
        if not isinstance(properties, dict):
            raise CandidateError("Missing feature properties")
        oid = properties.get("objectid")
        if type(oid) is not int or oid < 0 or oid in ids:
            raise CandidateError("Missing, negative, or duplicate source OBJECTID")
        if feature.get("id") is not None and feature["id"] != oid:
            raise CandidateError("Feature id and source OBJECTID do not match")
        if properties.get("county") != "Posey":
            raise CandidateError("Feature has unexpected county")
        ids.add(oid)

        geometry = feature.get("geometry")
        if not isinstance(geometry, dict) or geometry.get("type") not in ALLOWED_GEOMETRY_TYPES:
            raise CandidateError("Geometry is not Polygon/MultiPolygon")
        types[geometry["type"]] += 1
        try:
            polygon = shape(geometry)
        except (ValueError, TypeError, IndexError, AttributeError) as exc:
            raise CandidateError("Could not parse geometry") from exc
        if polygon.is_empty or not math.isfinite(polygon.area) or polygon.area <= 0:
            empty.append(oid)
            invalid.append({"sourceObjectId": oid, "reason": "EMPTY_OR_COLLAPSED_GEOMETRY"})
            continue
        west, south, east, north = polygon.bounds
        if not all(math.isfinite(x) for x in (west, south, east, north)):
            raise CandidateError("Nonfinite footprint bounds")
        if not (-90 < west < -84 and -90 < east < -84
                and 36 < south < 42 and 36 < north < 42):
            raise CandidateError("Footprint outside regional coordinate sanity bounds")
        parts = polygon.geoms if geometry["type"] == "MultiPolygon" else (polygon,)
        holes += sum(len(part.interiors) for part in parts)
        if not polygon.is_valid:
            invalid.append({"sourceObjectId": oid, "reason": safe_reason(explain_validity(polygon))})
        if any(type(properties.get(k)) in (int, float) and math.isfinite(properties[k])
               for k in ("lidarHeightFt", "heightFt")):
            heights += 1
        if any(type(properties.get(k)) in (int, float) and math.isfinite(properties[k])
               for k in ("groundElevationFt", "groundElevationMeanFt")):
            ground += 1
        # Raw source strings may contain identifiers. Reduce to fixed classifications.
        declared_sources["DECLARED_IGIO_LIKE" if properties.get("source") == DECLARED_SOURCE
                         else "OTHER_OR_UNDECLARED"] += 1
        year = properties.get("lidaryear")
        declared_years[str(year) if type(year) is int and 2000 <= year <= 2035
                       else "OTHER_OR_UNDECLARED"] += 1
    if len(ids) != expected_count:
        raise CandidateError("Source identity coverage differs from feature count")
    invalid.sort(key=lambda x: x["sourceObjectId"])
    minimum, maximum = min(ids), max(ids)
    topology_ok = not invalid
    receipt = {
        "schemaVersion": "tsm.igio-posey-candidate-audit.v1",
        "sourceClassification": "USER_SUPPLIED_UNVERIFIED_CANDIDATE",
        "sourceSha256": sha, "sourceBytes": size,
        "sourceAuthorityIndependentlyVerified": False,
        "surveyGradeVerified": False, "engineeringUse": False, "regulatoryUse": False,
        "countywide3DTilesAccepted": False,
        "featureCount": len(features), "expectedFeatureCount": expected_count,
        "uniqueSourceObjectIds": len(ids),
        "sourceObjectIdMinimum": minimum, "sourceObjectIdMaximum": maximum,
        "sourceObjectIdsContiguous": maximum - minimum + 1 == len(ids),
        "geometryTypeCounts": dict(sorted(types.items())),
        "holeRingCount": holes, "invalidGeometryCount": len(invalid),
        "invalidGeometries": invalid, "emptyGeometrySourceObjectIds": sorted(empty),
        "featuresWithExplicitHeight": heights,
        "featuresWithExplicitGroundElevation": ground,
        "declaredSourceLabelsUnverified": dict(sorted(declared_sources.items())),
        "declaredLidarYearsUnverified": dict(sorted(declared_years.items())),
        "geometryTopologyAccepted": topology_ok,
        "status": ("FOOTPRINT_INVENTORY_CHECKS_PASSED_ONLY" if topology_ok
                   else "TOPOLOGY_RECONCILIATION_REQUIRED"),
        "nextStep": ("Reconcile malformed polygons with official IGIO OBJECTIDs, "
                     "verify provenance and height/DEM evidence, then validate 3D Tiles"),
    }
    # Preserve coordinates and feature properties verbatim. Only add an ID alias.
    normalized_features = []
    for feature in sorted(features, key=lambda f: f["properties"]["objectid"]):
        candidate = dict(feature)
        candidate["properties"] = dict(feature["properties"])
        candidate["properties"]["igioObjectId"] = feature["properties"]["objectid"]
        normalized_features.append(candidate)
    normalized = {
        "type": "FeatureCollection",
        "sourceAuthorityStatus": "UNVERIFIED_USER_UPLOAD",
        "geometryCrsStatus": "UNDECLARED_SOURCE_METADATA",
        "geometryWasRepaired": False, "heightWasInferred": False,
        "features": normalized_features,
    }
    return receipt, normalized


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--normalized-output", type=Path)
    parser.add_argument("--expected-count", type=int, default=EXPECTED_COUNT)
    parser.add_argument("--expected-sha256")
    args = parser.parse_args()
    try:
        destinations = [args.receipt]
        if args.normalized_output:
            destinations.append(args.normalized_output)
        resolved = [item.resolve() for item in [args.input, *destinations]]
        if len(set(resolved)) != len(resolved) or any(path.exists() for path in destinations):
            raise CandidateError("Refusing to overwrite source or existing evidence")
        receipt, normalized = audit(args.input, expected_count=args.expected_count,
                                    expected_sha256=args.expected_sha256)
        args.receipt.parent.mkdir(parents=True, exist_ok=True)
        args.receipt.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        if args.normalized_output:
            args.normalized_output.parent.mkdir(parents=True, exist_ok=True)
            args.normalized_output.write_text(json.dumps(normalized, sort_keys=True,
                                                         separators=(",", ":")) + "\n", encoding="utf-8")
        print(json.dumps({key: receipt[key] for key in
                         ("status", "featureCount", "uniqueSourceObjectIds",
                          "invalidGeometryCount", "featuresWithExplicitHeight", "sourceSha256")}, sort_keys=True))
        return 0 if receipt["geometryTopologyAccepted"] else 2
    except (OSError, CandidateError) as exc:
        # Never include coordinates, private metadata, or supplied input paths.
        print("IGIO candidate audit rejected: " + type(exc).__name__)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
