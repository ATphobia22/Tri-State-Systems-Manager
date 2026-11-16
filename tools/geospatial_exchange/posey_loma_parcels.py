"""Build an offline parcel review queue from the pinned Posey BAFL snapshot."""
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path

from shapely.strtree import STRtree

from .posey_loma_screen import HAZARDS, PARCELS, UNASSIGNED, load, overlaps, polygon


def parcel_queue(root: Path) -> tuple[dict, list[tuple]]:
    parcels, parcel_hash = load(root, PARCELS)
    hazards, hazard_hash = load(root, HAZARDS)
    groups = [
        polygon(feature, repair=True)
        for feature in hazards
        if feature["properties"]["dfirm_id"] == "18129C"
        and feature["properties"]["sfha"] == "T"
    ]
    parts = [part for group in groups for part in group]
    if not parts:
        raise ValueError("Posey BAFL snapshot contains no usable SFHA geometry")

    tree = STRtree(parts)
    rows = []
    counts = Counter()
    parcel_ids = Counter(
        feature["properties"].get("state_parcel_id") or "" for feature in parcels
    )
    for ordinal, feature in enumerate(parcels, start=1):
        properties = feature["properties"]
        parcel_id = properties.get("state_parcel_id") or ""
        geometry = polygon(feature)
        if geometry is None:
            status = "UNUSABLE_PARCEL_GEOMETRY"
        elif overlaps(tree, geometry):
            status = "BAFL_AREA_OVERLAP"
        else:
            status = "NO_AREA_OVERLAP_IN_USABLE_BAFL"
        counts[status] += 1
        rows.append((
            ordinal, parcel_id, properties.get("tax_township") or UNASSIGNED,
            parcel_ids[parcel_id] if parcel_id else "", status,
            "INSUFFICIENT_EVIDENCE", "UNVERIFIED", "UNAVAILABLE",
        ))

    return {
        "input_sha256": {PARCELS: parcel_hash, HAZARDS: hazard_hash},
        "parcel_geometry_records": len(parcels),
        "distinct_nonblank_state_parcel_ids": sum(bool(key) for key in parcel_ids),
        "repeated_nonblank_state_parcel_ids": sum(
            bool(key) and count > 1 for key, count in parcel_ids.items()
        ),
        "usable_posey_bafl_source_features": sum(bool(group) for group in groups),
        "unusable_posey_bafl_source_features": sum(not group for group in groups),
        "counts_by_screening_status": dict(sorted(counts.items())),
        "eligibility_verified_records": 0,
    }, rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--queue-csv", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    args = parser.parse_args()
    summary, rows = parcel_queue(args.repo)
    with args.queue_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow((
            "snapshot_feature_ordinal", "state_parcel_id", "tax_township",
            "state_parcel_id_record_count", "bafl_screening_status", "review_status",
            "effective_fema_map_evidence", "certified_site_evidence",
        ))
        writer.writerows(rows)
    args.summary.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
