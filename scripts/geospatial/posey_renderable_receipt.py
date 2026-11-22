#!/usr/bin/env python3
"""Source-anchored Posey 2D inventory vs. optional eligible 3D subset audit.

Never suppress a missing height, copy a neighboring roof, or misrepresent
a partial 3D tileset as full county coverage. Source IDs come from the
separately sealed live IGIO receipt, not historical expected counts.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import Counter
from pathlib import Path


def canonical(obj):
    return (json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
            + "\n").encode("utf-8")


def require_id(p: dict) -> int:
    keys = ("igioObjectId", "objectid", "OBJECTID", "sourceObjectId")
    values = [p[k] for k in keys if k in p and p[k] is not None]
    if not values or any(type(n) is not int or n < 0 for n in values) or len(set(values)) != 1:
        raise ValueError("Missing or conflicting source OBJECTID")
    return values[0]


def positive(value) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and value > 0


def classify_height(props: dict) -> str:
    """Explicitly distinguish geometry eligibility from engineering acceptance."""
    if props.get("lidarHeightStatus") != "OK":
        return "HEIGHT_UNAVAILABLE"
    if props.get("heightProvenance") not in ("OBSERVED", "DERIVED"):
        return "HEIGHT_PROVENANCE_UNSUPPORTED"
    if (not positive(props.get("lidarHeightM"))
        or not positive(props.get("lidarHeightFt"))
        or abs(props["lidarHeightFt"] - 3.280839895013123 * props["lidarHeightM"]) > 0.1):
        return "HEIGHT_UNITS_INCONSISTENT"
    if not (type(props.get("lidarGroundElevM")) in (int, float)
            and type(props.get("lidarRoofElevM")) in (int, float)
            and math.isfinite(props["lidarGroundElevM"])
            and math.isfinite(props["lidarRoofElevM"])):
        return "ELEVATION_EVIDENCE_MISSING"
    if abs(props["lidarRoofElevM"] - props["lidarGroundElevM"] - props["lidarHeightM"]) > 0.03:
        return "ELEVATION_DIFFERENCE_MISMATCH"
    if props.get("lidarHeightDatum") != "NAVD88":
        return "VERTICAL_DATUM_UNVERIFIED"
    if not props.get("lidarSource") or not props.get("lidarHeightMethod"):
        return "SOURCE_METHOD_MISSING"
    return "PROVISIONAL_VISUALIZATION_ELIGIBLE"


def audit(source_receipt: dict, enriched: dict) -> tuple[dict, dict]:
    if (source_receipt.get("schema_version") != "tsm.indiana-posey-source-inventory.v1"
            or not source_receipt.get("source_identity_complete")
            or not isinstance(source_receipt.get("official_feature_count"), int)
            or source_receipt["official_feature_count"] <= 0):
        raise ValueError("A complete official live source identity receipt is mandatory")
    if enriched.get("type") != "FeatureCollection":
        raise ValueError("Expected a source-preserving GeoJSON FeatureCollection")
    features = enriched.get("features")
    if not isinstance(features, list):
        raise ValueError("Missing features")
    observed_ids = []
    for f in features:
        if not isinstance(f, dict) or f.get("type") != "Feature":
            raise ValueError("Malformed feature record")
        props = f.get("properties")
        if not isinstance(props, dict) or props.get("county") not in (None, "Posey"):
            raise ValueError("Unexpected county metadata")
        if f.get("geometry", {}).get("type") not in ("Polygon", "MultiPolygon"):
            raise ValueError("Missing source polygon geometry")
        observed_ids.append(require_id(props))
    if (len(features) != source_receipt["official_feature_count"]
            or len(set(observed_ids)) != len(features)
            or hashlib.sha256(canonical(sorted(observed_ids))).hexdigest()
            != source_receipt.get("official_sorted_objectids_sha256")):
        raise ValueError("Enriched geometry is not identity-complete against the live IGIO receipt")
    eligible = []
    statuses = Counter()
    for feature in features:
        status = classify_height(feature["properties"])
        statuses[status] += 1
        if status == "PROVISIONAL_VISUALIZATION_ELIGIBLE":
            eligible.append(feature)
    receipt = {
        "schema_version": "tsm.posey-verified-coverage.v1",
        "official_source_url": source_receipt["source"],
        "official_id_set_sha256": source_receipt["official_sorted_objectids_sha256"],
        "authoritative_2d_feature_count": len(features),
        "provisional_3d_visualization_eligible": len(eligible),
        "height_unavailable_or_unaccepted": len(features) - len(eligible),
        "classification_counts": dict(sorted(statuses.items())),
        "all_official_2d_ids_preserved": True,
        "source_geometry_certified": False,
        "complete_3d_county_coverage": len(eligible) == len(features),
        "dem_samples_independently_verified": False,
        "navd88_to_ecef_geoid_placement_verified": False,
        "regulatory_use": False,
        "release_status": "PREVIEW_ONLY_INDEPENDENT_TERRAIN_AND_3D_VALIDATION_REQUIRED",
    }
    output = {
        "type": "FeatureCollection",
        "sourceScope": "POSEY_IGIO_SUBSET_NOT_FULL_COUNTY",
        "sourceObjectIdsSha256": receipt["official_id_set_sha256"],
        "features": sorted(eligible, key=lambda feature: require_id(feature["properties"])),
    }
    return receipt, output


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source-receipt", required=True, type=Path)
    p.add_argument("--enriched-geojson", required=True, type=Path)
    p.add_argument("--receipt-out", required=True, type=Path)
    p.add_argument("--provisional-subset-out", type=Path)
    a = p.parse_args()
    src = json.loads(a.source_receipt.read_bytes())
    enriched = json.loads(a.enriched_geojson.read_bytes())
    report, subset = audit(src, enriched)
    outputs = [(a.receipt_out, canonical(report))]
    if a.provisional_subset_out:
        outputs.append((a.provisional_subset_out, canonical(subset)))
    for path, data in outputs:
        if path.exists() or path.resolve() in (a.source_receipt.resolve(), a.enriched_geojson.resolve()):
            raise ValueError("Refusing to replace source or existing evidence")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        path.with_suffix(path.suffix + ".sha256").write_text(
            hashlib.sha256(data).hexdigest() + "  " + path.name + "\n")
    print(json.dumps(report, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
