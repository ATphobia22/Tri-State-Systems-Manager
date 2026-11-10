#!/usr/bin/env python3
"""Convert candidate Posey building heights to explicitly nonengineering LoD1 map layers.

Never promotes estimated heights into observed elevations or survey-certified
3D buildings. Only the exact input file hash is accepted. The accepted layer
contains no address or raw source attributes. Invalid polygons are omitted,
NOT silently repaired or counted as accepted.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import math
import os
from pathlib import Path
import tempfile
from typing import Any

from shapely.geometry import shape

EXPECTED_COUNT = 23082
MAX_BYTES = 256 * 1024 * 1024
SOURCE_CLASSES = {
    "DEFAULT_RURAL_MEDIAN": "ESTIMATED_DEFAULT",
    "OVERTURE_NEAREST_20M": "ESTIMATED_THIRD_PARTY",
}
RAW_TO_VISUAL_KEYS = ("height_m", "heightM")
SOURCE_ID_KEYS = ("objectid", "OBJECTID", "igioObjectId", "sourceObjectId")
SHA256_HEX = set("0123456789abcdef")


def source_id(props: dict[str, Any]) -> int:
    values: set[int] = set()
    for key in SOURCE_ID_KEYS:
        val = props.get(key)
        if isinstance(val, bool):
            raise ValueError("BOOLEAN_SOURCE_ID")
        if isinstance(val, int) and val >= 0:
            values.add(val)
        elif isinstance(val, str) and val.isdecimal():
            values.add(int(val))
    if len(values) != 1:
        raise ValueError("MISSING_OR_CONFLICTING_SOURCE_ID")
    return next(iter(values))


def visualize_candidate(feature: dict[str, Any]) -> dict[str, Any] | None:
    props = feature.get("properties")
    if not isinstance(props, dict):
        raise ValueError("MISSING_PROPERTIES")
    sid = source_id(props)
    src = props.get("height_source", props.get("heightSource"))
    if src not in SOURCE_CLASSES:
        # Neither measurements, provenance, nor categorical building levels may
        # be fabricated from an unknown or unreviewed input.
        return None
    values = [props.get(key) for key in RAW_TO_VISUAL_KEYS if key in props]
    if len(values) != 1:
        raise ValueError("MISSING_OR_AMBIGUOUS_HEIGHT")
    h = values[0]
    if isinstance(h, bool) or not isinstance(h, (int, float)):
        raise ValueError("HEIGHT_NOT_NUMERIC_METERS")
    if not math.isfinite(h) or not 0 < h <= 300:
        raise ValueError("HEIGHT_OUT_OF_VISUAL_RANGE")
    geometry = feature.get("geometry")
    if not isinstance(geometry, dict) or geometry.get("type") not in ("Polygon", "MultiPolygon"):
        raise ValueError("INVALID_GEOMETRY_TYPE")
    polygon = shape(geometry)
    if polygon.is_empty or not polygon.is_valid or polygon.area <= 0:
        # Preserve the untouched source for review; do not buffer(0) or make_valid.
        return None
    return {
        "type": "Feature",
        "id": sid,
        "geometry": geometry,
        "properties": {
            "igio_objectid": sid,
            "tsm_visual_height_m": float(h),
            "tsm_visual_base_m": 0.0,
            "tsm_height_evidence": SOURCE_CLASSES[src],
            "tsm_visual_mode": "SCREENING_ONLY",
            "tsm_geometry_lod": "LoD1_ESTIMATED",
            "tsm_vertical_datum": "NOT_VERIFIED",
            "tsm_ground_elevation_available": False,
            "tsm_roof_geometry_observed": False,
            "tsm_engineering_approved": False,
        },
    }


def bounded_input(path: Path) -> tuple[dict[str, Any], str]:
    if not path.is_file() or path.is_symlink():
        raise ValueError("INPUT_NOT_REGULAR_FILE")
    if path.stat().st_size > MAX_BYTES or path.stat().st_size == 0:
        raise ValueError("INPUT_SIZE_LIMIT")
    raw = path.read_bytes()
    try:
        obj = json.loads(raw)
    except (ValueError, UnicodeDecodeError) as exc:
        raise ValueError("INPUT_NOT_VALID_GEOJSON") from exc
    if not isinstance(obj, dict) or obj.get("type") != "FeatureCollection":
        raise ValueError("INPUT_NOT_FEATURE_COLLECTION")
    return obj, hashlib.sha256(raw).hexdigest()


def prepare(input_path: Path, expected_sha: str, expected_count: int) -> tuple[dict, dict]:
    if len(expected_sha) != 64 or any(c not in SHA256_HEX for c in expected_sha):
        raise ValueError("EXPECTED_SOURCE_SHA256_REQUIRED")
    if type(expected_count) is not int or not 1 <= expected_count <= 500_000:
        raise ValueError("INVALID_EXPECTED_COUNT")
    source, actual_sha = bounded_input(input_path)
    if actual_sha != expected_sha:
        raise ValueError("SOURCE_SHA256_MISMATCH")
    features = source.get("features")
    if not isinstance(features, list) or len(features) != expected_count:
        raise ValueError("SOURCE_FEATURE_COUNT_MISMATCH")
    seen: set[int] = set()
    output: list[dict] = []
    stats: Counter[str] = Counter()
    for feature in features:
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise ValueError("INVALID_FEATURE")
        props = feature.get("properties")
        if not isinstance(props, dict):
            raise ValueError("INVALID_FEATURE_PROPERTIES")
        sid = source_id(props)
        if sid in seen:
            raise ValueError("DUPLICATE_SOURCE_ID")
        seen.add(sid)
        visual = visualize_candidate(feature)
        if visual is None:
            stats["excluded_unsupported_height_or_invalid_geometry"] += 1
            continue
        output.append(visual)
        stats[visual["properties"]["tsm_height_evidence"]] += 1
    result = {"type": "FeatureCollection", "features": output}
    receipt = {
        "schema": "tsm.posey-screening-extrusions.v1",
        "input_sha256": actual_sha,
        "input_feature_count": len(features),
        "output_feature_count": len(output),
        "excluded_feature_count": len(features) - len(output),
        "classification_counts": dict(sorted(stats.items())),
        "geometry_lod": "LoD1_ESTIMATED",
        "authority": "DERIVED_SCREENING_ONLY",
        "height_units": "m_AGL_estimated",
        "datum_verified": False,
        "roof_geometry_measured": False,
        "engineering_approved": False,
        "publishable_as_legal_or_regulatory_building_model": False,
        "note": "These are estimates and illustrative prisms only; ground/roof NAVD88 elevations remain unavailable.",
    }
    return result, receipt


def atomic_json(path: Path, obj: dict) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(dir=str(path.parent), prefix=".tsm-posey-")
    try:
        with os.fdopen(fd, "w", encoding="utf8") as f:
            json.dump(obj, f, sort_keys=True, separators=(",", ":"), allow_nan=False)
            f.write("\n")
        temp = Path(temp_name)
        sha = hashlib.sha256(temp.read_bytes()).hexdigest()
        os.replace(temp, path)
        return sha
    finally:
        Path(temp_name).unlink(missing_ok=True)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--expected-sha256", required=True)
    p.add_argument("--expected-count", type=int, default=EXPECTED_COUNT)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--receipt", required=True, type=Path)
    a = p.parse_args()
    if a.output.resolve() == a.input.resolve() or a.receipt.resolve() in (a.output.resolve(), a.input.resolve()):
        p.error("source, output, and receipt must be distinct")
    result, receipt = prepare(a.input, a.expected_sha256.lower(), a.expected_count)
    receipt["output_sha256"] = atomic_json(a.output, result)
    atomic_json(a.receipt, receipt)
    print(json.dumps({"visual_features": receipt["output_feature_count"], "excluded": receipt["excluded_feature_count"],
                      "screening_only": True}, sort_keys=True))


if __name__ == "__main__":
    main()
