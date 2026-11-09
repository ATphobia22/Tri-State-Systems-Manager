#!/usr/bin/env python3
"""Strict spatial join of IGIO building footprints to official Indiana address points.

Only an unambiguous single address point strictly *within* one footprint is
assigned automatically. Multiple points or no interior point stay unresolved.
No nearest-neighbour guessed street addresses are ever promoted. Record all
source OBJECTIDs and hashes. Run offline against downloaded official snapshots.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path

from shapely.geometry import shape
from shapely.strtree import STRtree
from shapely.validation import make_valid

from build_posey_clickable_lod1 import ADDRESS_SERVICE, EXPECTED_COUNT, EXPECTED_SHA256, FOOTPRINT_SERVICE, hash_file, polygons


def read_features(path: Path) -> list[dict]:
    if not path.is_file() or path.is_symlink() or not 0 < path.stat().st_size <= 256 * 1024 * 1024:
        raise ValueError("INPUT_NOT_BOUNDED_FILE")
    data = json.loads(path.read_text(encoding="utf8"))
    if not isinstance(data, dict) or data.get("type") != "FeatureCollection" or not isinstance(data.get("features"), list):
        raise ValueError("INPUT_NOT_GEOJSON")
    return data["features"]


def build_matches(buildings: list[dict], points: list[dict], address_snapshot_sha: str) -> tuple[dict, dict]:
    geom = []
    ids: list[int] = []
    used_ids: set[int] = set()
    for building in buildings:
        props = building.get("properties") or {}
        oid = props.get("objectid")
        if type(oid) is not int or oid in used_ids:
            raise ValueError("DUPLICATE_OR_INVALID_BUILDING_OBJECTID")
        used_ids.add(oid)
        g = shape(building["geometry"])
        if not g.is_valid:
            g = make_valid(g)
        if not polygons(g):
            raise ValueError("BUILDING_GEOMETRY_NOT_POLYGON")
        ids.append(oid)
        geom.append(g)
    tree = STRtree(geom)
    hits: dict[int, list[tuple[int, str]]] = {oid: [] for oid in ids}
    seen_address_ids: set[int] = set()
    for point in points:
        props = point.get("properties") or {}
        if props.get("county") not in ("Posey County", "Posey"):
            continue
        aid = props.get("objectid")
        if type(aid) is not int or aid in seen_address_ids:
            raise ValueError("DUPLICATE_OR_INVALID_ADDRESS_POINT_ID")
        seen_address_ids.add(aid)
        full_address = props.get("geofulladdress")
        if not isinstance(full_address, str) or not full_address.strip():
            continue
        pt = shape(point["geometry"])
        if pt.geom_type != "Point" or pt.is_empty:
            continue
        candidates = [int(index) for index in tree.query(pt) if geom[int(index)].contains(pt)]
        if len(candidates) == 1:
            hits[ids[candidates[0]]].append((aid, full_address.strip()))
    records = []
    stats: Counter[str] = Counter()
    for oid in ids:
        candidates = hits[oid]
        status = "ONE_POINT_WITHIN_BUILDING" if len(candidates) == 1 else "MULTIPLE_POINTS_WITHIN_BUILDING" if len(candidates) > 1 else "NO_POINT_WITHIN_BUILDING"
        row = {
            "building_objectid": oid,
            "match_status": status,
            "source_layer_url": ADDRESS_SERVICE,
            "source_snapshot_sha256": address_snapshot_sha,
            "address_point_count": len(candidates),
        }
        if len(candidates) == 1:
            row["address_point_objectid"] = candidates[0][0]
            row["geofulladdress"] = candidates[0][1]
        records.append({"type": "Feature", "geometry": None, "properties": row})
        stats[status] += 1
    result = {
        "type": "FeatureCollection",
        "tsm_match_schema": "tsm.reviewed-posey-address-match.v1",
        "source_layer_url": ADDRESS_SERVICE,
        "source_snapshot_sha256": address_snapshot_sha,
        "features": records,
    }
    receipt = {
        "schema": "tsm.posey-address-spatial-join.v1",
        "address_source": ADDRESS_SERVICE,
        "footprint_source": FOOTPRINT_SERVICE,
        "address_snapshot_sha256": address_snapshot_sha,
        "buildings_checked": len(ids),
        "outcome_counts": dict(stats),
        "method": "exactly-one-official-address-point-strictly-inside-a-building",
        "unmatched_and_ambiguous_are_not_fabricated": True,
        "source_is_public_address_dataset_not_survey_certification": True,
    }
    return result, receipt


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--buildings", required=True, type=Path)
    parser.add_argument("--addresses", required=True, type=Path, help="Official Posey IGIO address-point GeoJSON snapshot")
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--receipt", required=True, type=Path)
    args = parser.parse_args()
    if hash_file(args.buildings) != EXPECTED_SHA256:
        raise ValueError("UNEXPECTED_BUILDING_SNAPSHOT_SHA")
    buildings = read_features(args.buildings)
    if len(buildings) != EXPECTED_COUNT:
        raise ValueError("BUILDING_COUNT_MISMATCH")
    address_sha = hash_file(args.addresses)
    result, receipt = build_matches(buildings, read_features(args.addresses), address_sha)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf8")
    receipt["matches_sha256"] = hash_file(args.out)
    args.receipt.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf8")
    print(json.dumps(receipt["outcome_counts"]))


if __name__ == "__main__":
    main()
