"""Count mapped footprint overlaps in pinned TSM snapshots for LOMA research."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

from shapely import make_valid
from shapely.geometry import shape
from shapely.strtree import STRtree

BUILDINGS = "tsm-console/public/3d-tiles/buildings-3d.json"
PARCELS = "data/posey-county/parcels/posey-parcels-2025.geojson"
HAZARDS = "data/posey-county/floodplain/posey-flood-hazard-sfha.geojson"
UNASSIGNED = "UNASSIGNED"


def load(root, path):
    payload = (root / path).read_bytes()
    return json.loads(payload)["features"], hashlib.sha256(payload).hexdigest()


def polygon(feature, repair=False):
    geometry = feature.get("geometry")
    if not geometry:
        return [] if repair else None
    geom = shape(geometry)
    if repair and not geom.is_valid:
        return list(polygon_parts(make_valid(geom)))
    if geom.geom_type in {"Polygon", "MultiPolygon"} and geom.is_valid and geom.area > 0:
        return [geom] if repair else geom
    return [] if repair else None


def polygon_parts(geom):
    if geom.geom_type in {"Polygon", "MultiPolygon"} and geom.area > 0:
        yield geom
    elif geom.geom_type == "GeometryCollection":
        for part in geom.geoms:
            yield from polygon_parts(part)


def overlaps(tree, geom):
    # DE-9IM: interiors intersect in two dimensions. Boundary touches contribute no area.
    return [
        index for index in tree.query(geom)
        if geom.relate_pattern(tree.geometries[index], "2********")
    ]


def inventory(root):
    buildings, buildings_hash = load(root, BUILDINGS)
    parcels, parcels_hash = load(root, PARCELS)
    hazards, hazards_hash = load(root, HAZARDS)
    posey_hazards = [
        item for item in hazards
        if item["properties"]["dfirm_id"] == "18129C" and item["properties"]["sfha"] == "T"
    ]
    hazard_groups = [polygon(item, repair=True) for item in posey_hazards]
    hazard_polygons = [geom for group in hazard_groups for geom in group]
    parcel_records = [
        (g, item["properties"]) for item in parcels if (g := polygon(item)) is not None
    ]
    if not hazard_polygons:
        raise ValueError("Posey SFHA snapshot contains no usable polygons")
    if not parcel_records:
        raise ValueError("Parcel snapshot contains no valid polygons")
    parcel_tree = STRtree([geom for geom, _ in parcel_records])
    hazard_tree = STRtree(hazard_polygons)
    seen, rows = set(), []
    counts = Counter()
    parcel_counts = Counter(p["properties"].get("tax_township") or UNASSIGNED for p in parcels)
    township_counts = Counter()
    for item in buildings:
        props = item["properties"]
        structure_id = str(props.get("id") or "").strip()
        if not structure_id or structure_id in seen:
            raise ValueError(f"Missing or duplicate structure ID {structure_id!r}")
        seen.add(structure_id)
        geom = polygon(item)
        if geom is None:
            counts["unusable_footprints"] += 1
            continue
        if not overlaps(hazard_tree, geom):
            counts["no_mapped_overlap"] += 1
            continue
        matches = overlaps(parcel_tree, geom)
        township = UNASSIGNED
        parcel_id = ""
        if len(matches) == 1:
            parcel = parcel_records[matches[0]][1]
            township = parcel.get("tax_township") or UNASSIGNED
            parcel_id = parcel.get("state_parcel_id") or ""
            match = "UNIQUE"
        elif matches:
            match = "AMBIGUOUS"
        else:
            match = "NO_MATCH"
        rows.append((structure_id, parcel_id, township, match, "FOOTPRINT_SFHA_OVERLAP"))
        township_counts[township] += 1
        counts[match] += 1
    return {
        "input_sha256": {BUILDINGS: buildings_hash, PARCELS: parcels_hash, HAZARDS: hazards_hash},
        "footprint_records": len(buildings),
        "parcel_records": len(parcels),
        "unusable_parcel_geometry": len(parcels) - len(parcel_records),
        "posey_sfha_polygons": len(posey_hazards),
        "repaired_sfha_features": sum(
            bool(group) and polygon(item) is None
            for item, group in zip(posey_hazards, hazard_groups)
        ),
        "unusable_sfha_features": sum(not group for group in hazard_groups),
        "sfha_overlap_footprints": len(rows),
        "no_mapped_overlap": counts["no_mapped_overlap"],
        "unusable_footprints": counts["unusable_footprints"],
        "unique_parcel_match": counts["UNIQUE"],
        "ambiguous_parcel_match": counts["AMBIGUOUS"],
        "no_parcel_match": counts["NO_MATCH"],
        "township_parcel_records": dict(sorted(parcel_counts.items())),
        "township_overlap_footprints": dict(sorted(township_counts.items())),
    }, sorted(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--summary", type=Path, required=True)
    parser.add_argument("--screening-csv", type=Path, required=True)
    args = parser.parse_args()
    summary, rows = inventory(args.repo)
    args.summary.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    with args.screening_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(("structure_id", "state_parcel_id", "tax_township", "parcel_match", "screening_status"))
        writer.writerows(rows)


if __name__ == "__main__":
    main()
