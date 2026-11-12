#!/usr/bin/env python3
"""Evaluate DPIRD Building-Regulariser candidates without replacing source polygons.

This is optional workbench code. Requires explicitly installed GeoPandas and
buildingregulariser; no external dependencies installed by this file.
Geometry is retained as DERIVED, never surveyed or source-authoritative.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def evaluate(input_path: Path, output_path: Path, report_path: Path, *, id_field: str,
             max_area_change: float, max_hausdorff_native: float) -> dict:
    if not 0 <= max_area_change < 1 or not math.isfinite(max_hausdorff_native) or max_hausdorff_native <= 0:
        raise ValueError("invalid geometry acceptance bounds")
    if output_path.exists() or report_path.exists():
        raise FileExistsError("refusing to overwrite candidate geometry or evidence")
    if input_path.is_symlink():
        raise ValueError("symlink source not permitted")
    try:
        import geopandas as gpd
        from buildingregulariser import regularize_geodataframe
    except ImportError as exc:
        raise RuntimeError("review and explicitly install geopandas and buildingregulariser") from exc
    source = gpd.read_file(input_path)
    if not source.crs or not source.crs.is_projected:
        raise ValueError("projected CRS and explicit native units required before polygon regularization")
    if id_field not in source.columns or source[id_field].isna().any() or source[id_field].duplicated().any():
        raise ValueError("missing or duplicate authoritative feature IDs")
    if len(source) == 0:
        raise ValueError("empty footprint inventory")
    if source.geometry.isna().any() or not source.geometry.is_valid.all():
        raise ValueError("invalid source geometry: review and repair separately")
    candidates = regularize_geodataframe(source.copy())
    if len(candidates) != len(source) or id_field not in candidates.columns:
        raise RuntimeError("regularization unexpectedly changed identity count")
    if candidates[id_field].astype(str).tolist() != source[id_field].astype(str).tolist():
        raise RuntimeError("regularization changed feature identities or order")
    statuses = []
    approved = []
    for before, after in zip(source.geometry, candidates.geometry):
        if after is None or after.is_empty or not after.is_valid or after.geom_type != before.geom_type:
            statuses.append("REJECTED_INVALID_GEOMETRY")
            approved.append(before)
            continue
        change = abs(after.area - before.area) / max(before.area, 1e-12)
        drift = float(before.hausdorff_distance(after))
        if change > max_area_change or drift > max_hausdorff_native:
            statuses.append("REJECTED_TOLERANCE_EXCEEDED")
            approved.append(before)
        else:
            statuses.append("CANDIDATE_UNREVIEWED")
            approved.append(after)
    candidates = source.copy()
    candidates.geometry = approved
    candidates["tsm_regularization_status"] = statuses
    output_path.parent.mkdir(parents=True, exist_ok=True)
    candidates.to_file(output_path, driver="GPKG")
    report = {
        "schema": "tsm.building-regularization-candidate.v1",
        "source_sha256": hash_file(input_path),
        "candidate_sha256": hash_file(output_path),
        "source_crs": str(source.crs),
        "geometry_units": "SOURCE_PROJECTED_CRS_UNITS",
        "source_features": len(source),
        "retained_original": sum(x.startswith("REJECTED") for x in statuses),
        "candidate_unreviewed": statuses.count("CANDIDATE_UNREVIEWED"),
        "review_status": "HUMAN_AND_LIDAR_VALIDATION_REQUIRED",
        "method": "DPIRD-DMA Building-Regulariser via regularize_geodataframe",
        "not_proven": ["LOD2", "LOD3", "roof elevations", "survey certification"]
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--id-field", default="objectid")
    parser.add_argument("--max-area-change", type=float, default=0.08)
    parser.add_argument("--max-hausdorff-native", type=float, default=5)
    a = parser.parse_args()
    print(json.dumps(evaluate(a.input, a.output, a.report, id_field=a.id_field,
                              max_area_change=a.max_area_change,
                              max_hausdorff_native=a.max_hausdorff_native), indent=2))
