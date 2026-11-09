#!/usr/bin/env python3
"""Produce complete clickable Posey LoD1 visual geometry; never certify heights.

Source has 23,082 IGIO footprint identities and estimated heights. Uses a
separate render-only make_valid on any invalid source geometry. Original IGIO
footprints remain untouched. Optional address matches are explicit reviewed
OBJECTID joins; unknown/ambiguous addresses remain unavailable.
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

from shapely.geometry import MultiPolygon, mapping, shape
from shapely.validation import make_valid

EXPECTED_SHA256 = "617a6116aaccac87354f0fa02285e322ec07c4e99ca9f0a14739f2c44f5cf881"
EXPECTED_COUNT = 23082
MAX_INPUT = 256 * 1024 * 1024
FOOTPRINT_SERVICE = "https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0"
ADDRESS_SERVICE = "https://gisdata.in.gov/server/rest/services/Hosted/Address_Points_of_Indiana_2025/FeatureServer/0"
HEIGHT_CLASSES = {
    "DEFAULT_RURAL_MEDIAN": "ESTIMATED_DEFAULT",
    "OVERTURE_NEAREST_20M": "ESTIMATED_THIRD_PARTY",
}


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as reader:
        for chunk in iter(lambda: reader.read(1048576), b""):
            digest.update(chunk)
    return digest.hexdigest()


def polygons(geom: Any) -> list[Any]:
    if geom.geom_type == "Polygon":
        return [geom]
    if geom.geom_type == "MultiPolygon":
        return list(geom.geoms)
    if geom.geom_type == "GeometryCollection":
        return [p for child in geom.geoms for p in polygons(child)]
    return []


def checked_input(path: Path, sha: str) -> dict:
    if not path.is_file() or path.is_symlink() or not 0 < path.stat().st_size <= MAX_INPUT:
        raise ValueError("SOURCE_INPUT_NOT_REGULAR_BOUNDED_FILE")
    if hash_file(path) != sha:
        raise ValueError("SOURCE_SHA256_MISMATCH")
    raw = json.loads(path.read_text(encoding="utf8"))
    if not isinstance(raw, dict) or raw.get("type") != "FeatureCollection" or not isinstance(raw.get("features"), list):
        raise ValueError("SOURCE_NOT_GEOJSON_FEATURE_COLLECTION")
    return raw


def address_table(path: Path | None) -> tuple[dict[int, str], str | None]:
    if not path:
        return {}, None
    data = checked_input(path, hash_file(path))
    # Match evidence is a FeatureCollection of reviewed points with explicit IDs.
    if data.get("tsm_match_schema") != "tsm.reviewed-posey-address-match.v1":
        raise ValueError("ADDRESS_MATCH_NOT_REVIEWED")
    matches = {}
    for row in data["features"]:
        props = row.get("properties") or {}
        bid = props.get("building_objectid")
        label = props.get("geofulladdress")
        if type(bid) is not int or bid in matches:
            raise ValueError("ADDRESS_MATCH_DUPLICATE_OR_INVALID_ID")
        if (props.get("match_status") == "ONE_POINT_WITHIN_BUILDING" and
                props.get("source_layer_url") == ADDRESS_SERVICE and
                isinstance(label, str) and 0 < len(label.strip()) <= 240):
            matches[bid] = label.strip()
        else:
            matches[bid] = ""
    return matches, hash_file(path)


def make_visual(feature: dict, addresses: dict[int, str]) -> tuple[dict, bool]:
    if not isinstance(feature, dict) or feature.get("type") != "Feature":
        raise ValueError("INVALID_SOURCE_FEATURE")
    props = feature.get("properties")
    if not isinstance(props, dict):
        raise ValueError("MISSING_SOURCE_PROPERTIES")
    oid = props.get("objectid")
    if type(oid) is not int or oid < 0:
        raise ValueError("MISSING_SOURCE_OBJECTID")
    height = props.get("height_m")
    height_source = props.get("height_source")
    if height_source not in HEIGHT_CLASSES or type(height) not in (int, float) or not math.isfinite(height) or not 0 < height <= 300:
        raise ValueError("UNSUPPORTED_OR_MISSING_ESTIMATED_HEIGHT")
    geom = shape(feature["geometry"])
    if geom.is_empty or geom.area <= 0:
        raise ValueError("EMPTY_SOURCE_FOOTPRINT")
    render_changed = not geom.is_valid
    if render_changed:
        parts = [part for part in polygons(make_valid(geom)) if part.is_valid and not part.is_empty and part.area > 0]
        if not parts:
            raise ValueError("UNREPAIRABLE_RENDER_ONLY_GEOMETRY")
        geom = parts[0] if len(parts) == 1 else MultiPolygon(parts)
        if not geom.is_valid:
            raise ValueError("RENDER_ONLY_GEOMETRY_STILL_INVALID")
    address = addresses.get(oid, "")
    attributes = {
        "igio_objectid": oid,
        "tsm_visual_height_m": float(height),
        "tsm_visual_base_m": 0.0,
        "tsm_height_evidence": HEIGHT_CLASSES[height_source],
        "tsm_height_source": height_source,
        "tsm_geometry_lod": "LoD1_ESTIMATED",
        "tsm_visual_mode": "SCREENING_ONLY",
        "tsm_engineering_approved": False,
        "tsm_vertical_datum": "NOT_VERIFIED",
        "tsm_ground_elevation_available": False,
        "tsm_roof_geometry_observed": False,
        "tsm_geometry_status": "REPAIRED_VISUAL_ONLY" if render_changed else "SOURCE_GEOMETRY_VALID",
        "tsm_address": address,
        "tsm_address_status": "MATCHED_OFFICIAL_POINT" if address else "ADDRESS_NOT_VERIFIED",
        "tsm_footprint_source": FOOTPRINT_SERVICE,
        "tsm_footprint_source_year": str(props.get("lidaryear") or "NOT_KNOWN"),
        "tsm_height_source_detail": "No observed LiDAR height verification",
        "tsm_ground_source": str(props.get("elev_source") or "NOT_KNOWN"),
        "tsm_derived_geojson_sha256": EXPECTED_SHA256,
    }
    if address:
        attributes["tsm_address_source"] = ADDRESS_SERVICE
    for old, new in (("SHAPE__Area", "tsm_original_shape_area"), ("SHAPE__Length", "tsm_original_shape_length")):
        val = props.get(old)
        if type(val) in (int, float) and math.isfinite(val):
            attributes[new] = float(val)
    return {"type": "Feature", "id": oid, "geometry": mapping(geom), "properties": attributes}, render_changed


def generate(input_file: Path, *, source_sha: str = EXPECTED_SHA256,
             expected_count: int = EXPECTED_COUNT, addresses_file: Path | None = None) -> tuple[dict, dict]:
    raw = checked_input(input_file, source_sha)
    if len(raw["features"]) != expected_count:
        raise ValueError("INPUT_COUNT_MISMATCH")
    addresses, address_sha = address_table(addresses_file)
    seen: set[int] = set()
    output = []
    changed_ids = []
    counts: Counter[str] = Counter()
    for original in raw["features"]:
        rendered, changed = make_visual(original, addresses)
        oid = rendered["properties"]["igio_objectid"]
        if oid in seen:
            raise ValueError("DUPLICATE_SOURCE_OBJECTID")
        seen.add(oid)
        output.append(rendered)
        counts[rendered["properties"]["tsm_height_evidence"]] += 1
        counts[rendered["properties"]["tsm_address_status"]] += 1
        if changed:
            changed_ids.append(oid)
    receipt = {
        "schema": "tsm.posey-clickable-lod1.v1",
        "source_sha256": source_sha,
        "source_count": expected_count,
        "output_count": len(output),
        "unique_objectids": len(seen),
        "visual_repairs_objectids": changed_ids,
        "visual_repairs_count": len(changed_ids),
        "height_and_address_classes": dict(counts),
        "address_match_receipt_sha256": address_sha,
        "roof_measurements_verified": False,
        "navd88_verified": False,
        "official_building_geometry_modified": False,
        "engineering_approved": False,
        "note": "All output geometry is derived screening geometry. make_valid is only on temporary render copies.",
    }
    return {"type": "FeatureCollection", "features": output}, receipt


def atomic_write(path: Path, data: dict) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".tsm-lod1-", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf8") as stream:
            json.dump(data, stream, separators=(",", ":"), sort_keys=True, allow_nan=False)
            stream.write("\n")
        temporary = Path(name)
        sha = hash_file(temporary)
        os.replace(temporary, path)
        return sha
    finally:
        Path(name).unlink(missing_ok=True)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--expected-sha256", default=EXPECTED_SHA256)
    p.add_argument("--expected-count", type=int, default=EXPECTED_COUNT)
    p.add_argument("--address-matches", type=Path)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--receipt", type=Path, required=True)
    a = p.parse_args()
    if a.input.resolve() in (a.output.resolve(), a.receipt.resolve()) or a.output.resolve() == a.receipt.resolve():
        p.error("input, output and receipt paths must be distinct")
    layer, receipt = generate(a.input, source_sha=a.expected_sha256.lower(),
                              expected_count=a.expected_count, addresses_file=a.address_matches)
    receipt["output_sha256"] = atomic_write(a.output, layer)
    atomic_write(a.receipt, receipt)
    print(json.dumps({"rendered": receipt["output_count"], "repairs": receipt["visual_repairs_count"],
                      "matched_addresses": receipt["height_and_address_classes"].get("MATCHED_OFFICIAL_POINT", 0)}))


if __name__ == "__main__":
    main()
