#!/usr/bin/env python3
"""End-to-end acceptance gate for the 23,082-feature Posey building chain.

The gate is intentionally stricter than a file/count smoke test. It verifies
stable source identity, real height provenance, accepted per-feature LOD
outcomes, and exclusion of simulated/scenario records. It never synthesizes
missing measurements. Incomplete diagnostics may be reported with
--allow-incomplete, but that mode must never be used for publication.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter
from pathlib import Path
from typing import Any

EXPECTED_HEIGHT_SOURCES = {"OBSERVED", "DERIVED"}
SIMULATED_MARKERS = {"SIMULATED", "SCENARIO", "FORECAST"}
ID_KEYS = ("OBJECTID", "objectid", "igioObjectId", "sourceObjectId", "source_object_id")


def fail(message: str) -> None:
    raise ValueError(message)


def feature_id(properties: dict[str, Any]) -> int:
    for key in ID_KEYS:
        value = properties.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)) and math.isfinite(value) and int(value) == value:
            if int(value) >= 0:
                return int(value)
        if isinstance(value, str) and value.strip().isdigit():
            return int(value.strip())
    fail(f"missing non-negative integer source OBJECTID in properties keys {ID_KEYS}")
    raise AssertionError("unreachable")


def finite_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate_feature(feature: dict[str, Any], index: int, violations: list[str]) -> int | None:
    props = feature.get("properties")
    if not isinstance(props, dict):
        violations.append(f"feature[{index}]: properties missing or not an object")
        return None
    try:
        sid = feature_id(props)
    except ValueError as exc:
        violations.append(f"feature[{index}]: {exc}")
        sid = None

    # Reject simulation leakage regardless of which provenance field carried it.
    for key in ("authorityClass", "authority_class", "branch", "dataBranch", "stateType", "state_type"):
        value = props.get(key)
        if isinstance(value, str) and value.strip().upper() in SIMULATED_MARKERS:
            violations.append(f"feature[{index}] OBJECTID={sid}: simulated marker {key}={value!r} is not allowed in authoritative building set")
    if props.get("simulated") is True or props.get("isSimulated") is True:
        violations.append(f"feature[{index}] OBJECTID={sid}: simulation boolean is true")

    height_status = props.get("lidarHeightStatus")
    if height_status != "OK":
        violations.append(f"feature[{index}] OBJECTID={sid}: lidarHeightStatus={height_status!r}; no synthetic fallback is permitted")
    else:
        source_class = str(props.get("heightProvenance", props.get("lidarHeightProvenance", ""))).upper()
        if source_class not in EXPECTED_HEIGHT_SOURCES:
            violations.append(f"feature[{index}] OBJECTID={sid}: height provenance must be OBSERVED or DERIVED, got {source_class!r}")
        height_m = props.get("lidarHeightM")
        height_ft = props.get("lidarHeightFt")
        if not finite_number(height_m) or not finite_number(height_ft) or height_m <= 0 or height_m > 100:
            violations.append(f"feature[{index}] OBJECTID={sid}: height must be finite, positive, and <=100 m in both units")
        if not finite_number(props.get("lidarGroundElevM")) or not finite_number(props.get("lidarRoofElevM")):
            violations.append(f"feature[{index}] OBJECTID={sid}: ground and roof elevations are required")
        else:
            if abs((props["lidarRoofElevM"] - props["lidarGroundElevM"]) - height_m) > 0.03:
                violations.append(f"feature[{index}] OBJECTID={sid}: roof-ground delta does not agree with lidarHeightM")
        roof_count = props.get("lidarRoofPoints")
        ground_count = props.get("lidarGroundPoints")
        if not isinstance(roof_count, int) or roof_count < 5:
            violations.append(f"feature[{index}] OBJECTID={sid}: at least 5 qualifying roof points required")
        if not isinstance(ground_count, int) or ground_count < 3:
            violations.append(f"feature[{index}] OBJECTID={sid}: at least 3 qualifying ground points required")
        if not props.get("lidarSource") or not props.get("lidarHeightMethod"):
            violations.append(f"feature[{index}] OBJECTID={sid}: height source and method provenance are required")
        if props.get("lidarHeightDatum") != "NAVD88":
            violations.append(f"feature[{index}] OBJECTID={sid}: height vertical datum must be NAVD88")

    lod = props.get("achievedLod")
    lod_note = str(props.get("lodNote", ""))
    if lod not in (1, 2):
        violations.append(f"feature[{index}] OBJECTID={sid}: achievedLod must be 1 or 2, got {lod!r}")
    elif lod == 1:
        if not lod_note.strip():
            violations.append(f"feature[{index}] OBJECTID={sid}: LOD1 fallback requires an explicit reason")
    else:
        planes = props.get("roofPlanes")
        if not isinstance(planes, list) or not planes:
            violations.append(f"feature[{index}] OBJECTID={sid}: LOD2 requires at least one reconstructed roof plane")
        else:
            for plane_index, plane in enumerate(planes):
                normal, d, inliers = plane.get("normal"), plane.get("d"), plane.get("inlier_count")
                if (not isinstance(normal, list) or len(normal) != 3 or
                    not all(finite_number(v) for v in normal) or
                    not finite_number(d) or not isinstance(inliers, int) or inliers < 100):
                    violations.append(f"feature[{index}] OBJECTID={sid}: roof plane {plane_index} lacks finite plane parameters or 100 inliers")
                    break
    return sid


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--geojson", required=True, type=Path)
    parser.add_argument("--expected-count", type=int, default=23082)
    parser.add_argument("--allow-incomplete", action="store_true",
                        help="diagnostic-only report mode; never use for authoritative publication")
    args = parser.parse_args()

    try:
        data = json.loads(args.geojson.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"FAIL: cannot read GeoJSON: {exc}", file=sys.stderr)
        return 2
    features = data.get("features") if isinstance(data, dict) else None
    if not isinstance(features, list):
        print("FAIL: input must be a GeoJSON FeatureCollection", file=sys.stderr)
        return 2

    violations: list[str] = []
    if len(features) != args.expected_count:
        violations.append(f"feature cardinality {len(features)} != expected {args.expected_count}")
    ids = []
    for index, feature in enumerate(features):
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            violations.append(f"feature[{index}]: invalid GeoJSON Feature")
            continue
        sid = validate_feature(feature, index, violations)
        if sid is not None:
            ids.append(sid)
    counts = Counter(ids)
    duplicates = sorted(sid for sid, count in counts.items() if count != 1)
    if duplicates:
        violations.append(f"source OBJECTIDs are not unique: {len(duplicates)} duplicates, examples={duplicates[:10]}")
    if len(ids) != args.expected_count:
        violations.append(f"valid source OBJECTID count {len(ids)} != expected {args.expected_count}")

    height_ok = sum(1 for f in features if isinstance(f, dict) and isinstance(f.get("properties"), dict) and f["properties"].get("lidarHeightStatus") == "OK")
    lod2 = sum(1 for f in features if isinstance(f, dict) and isinstance(f.get("properties"), dict) and f["properties"].get("achievedLod") == 2)
    lod1 = sum(1 for f in features if isinstance(f, dict) and isinstance(f.get("properties"), dict) and f["properties"].get("achievedLod") == 1)
    print(json.dumps({
        "expected_features": args.expected_count,
        "actual_features": len(features),
        "unique_valid_objectids": len(set(ids)),
        "height_linked": height_ok,
        "height_unavailable": len(features) - height_ok,
        "lod2": lod2,
        "lod1": lod1,
        "violations": len(violations),
        "diagnostic_only": args.allow_incomplete,
    }, indent=2))
    if violations:
        for item in violations[:50]:
            print(f"FAIL: {item}", file=sys.stderr)
        if len(violations) > 50:
            print(f"... {len(violations) - 50} additional violations omitted", file=sys.stderr)
        # Diagnostic mode only reports gaps; it is not an acceptance pass.
        return 0 if args.allow_incomplete else 1
    print("PASS: full 23,082-feature height, LOD outcome, identity, and authority-isolation chain accepted")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
