#!/usr/bin/env python3
"""Run the real Transvoxel transition-cell mesher over a bounded USGS DEM patch.

This is a reproducible raster-backed transition-boundary benchmark, not a full
adaptive-octree terrain mesher or an engineering-grade elevation product. It
requires the acquisition job's real GeoTIFF and evidence JSON, preserves their
hashes/provenance, fails closed on unsupported CRS or insufficient valid data,
and records actual wall time, process peak RSS, mesh counts and seam comparisons.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import resource
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.transform import Affine
from rasterio.warp import calculate_default_transform, reproject, Resampling

from transvoxel_transition_mesh import mesh_transition_cell

TARGET_CRS = "EPSG:32616"
PATCH_PIXELS = 128
CELL_SIZE_METERS = 20.0
SEAM_TOLERANCE_METERS = 0.02


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _stable_sdf_sample(z: float, height: float, tolerance_m: float = 1e-5) -> float:
    """Bias near-zero float32 DEM samples consistently positive to avoid exact-corner ambiguity."""
    if not math.isfinite(z) or not math.isfinite(height) or not math.isfinite(tolerance_m) or tolerance_m < 0:
        raise ValueError("SDF inputs must be finite and tolerance must be nonnegative")
    distance = float(z) - float(height)
    return tolerance_m if abs(distance) <= tolerance_m else distance


def _rss_bytes() -> int:
    value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    # Linux reports KiB; macOS reports bytes. This CI runs on Linux, but retain
    # a platform check so the evidence is not silently mislabelled elsewhere.
    return int(value if sys.platform == "darwin" else value * 1024)


def _seam_key(vertices: list[tuple[float, float, float]], axis: int, coordinate: float) -> tuple[str, ...]:
    # Positional seam tolerance is 2 cm; plane membership must be much tighter.
    # Otherwise near-face interior vertices can be falsely counted as seam points.
    plane_epsilon_m = 1e-4
    unique = set()
    for point in vertices:
        if abs(point[axis] - coordinate) > plane_epsilon_m:
            continue
        normalized = list(point)
        normalized[axis] = coordinate
        unique.add(",".join(f"{value:.2f}" for value in normalized))
    return tuple(sorted(unique))


def run_benchmark(raster_path: Path, evidence_path: Path, output_path: Path, patch_pixels: int) -> dict[str, Any]:
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    if evidence.get("evidenceStatus") != "REAL_DATA_SCREENING_ONLY":
        raise ValueError("input evidence report is not marked REAL_DATA_SCREENING_ONLY")
    approval = evidence.get("aoi", {}).get("approvalStatus")
    if approval != "UNAPPROVED":
        raise ValueError(f"expected an explicitly unapproved screening AOI, got {approval!r}")
    raster_hash = sha256_file(raster_path)
    source_records = evidence.get("sources")
    if not isinstance(source_records, list):
        raise ValueError("acquisition evidence has no source provenance list")
    usgs_source = next(
        (record for record in source_records if record.get("authority") == "U.S. Geological Survey"),
        None,
    )
    if not isinstance(usgs_source, dict) or usgs_source.get("rasterSha256") != raster_hash:
        raise ValueError("raster SHA-256 does not match the authoritative USGS source record")

    with rasterio.open(raster_path) as src:
        if src.count < 1 or src.crs is None:
            raise ValueError("source raster must have a band and a declared CRS")
        src_crs = src.crs
        src_nodata = src.nodata if src.nodata is not None else -999999.0
        transform, width, height = calculate_default_transform(
            src_crs, TARGET_CRS, src.width, src.height, *src.bounds,
            resolution=(CELL_SIZE_METERS, CELL_SIZE_METERS),
        )
        if width < patch_pixels + 2 or height < patch_pixels + 2:
            raise ValueError(f"projected raster too small for a {patch_pixels}-pixel benchmark patch ({width}x{height})")
        projected = np.full((height, width), np.nan, dtype=np.float32)
        reproject(
            source=rasterio.band(src, 1),
            destination=projected,
            src_transform=src.transform,
            src_crs=src_crs,
            src_nodata=src_nodata,
            dst_transform=transform,
            dst_crs=TARGET_CRS,
            dst_nodata=np.nan,
            resampling=Resampling.bilinear,
        )

    valid = np.isfinite(projected)
    if src_nodata is not None:
        valid &= projected != src_nodata
    valid_rows, valid_cols = np.nonzero(valid)
    if valid_rows.size < patch_pixels * patch_pixels:
        raise ValueError("insufficient valid projected pixels for representative-area benchmark")
    row_center = int(np.median(valid_rows))
    col_center = int(np.median(valid_cols))
    row0 = max(1, min(height - patch_pixels - 1, row_center - patch_pixels // 2))
    col0 = max(1, min(width - patch_pixels - 1, col_center - patch_pixels // 2))
    patch = projected[row0:row0 + patch_pixels + 1, col0:col0 + patch_pixels + 1]
    patch_valid = np.isfinite(patch)
    if src_nodata is not None:
        patch_valid &= patch != src_nodata
    valid_fraction = float(np.count_nonzero(patch_valid) / patch_valid.size)
    if valid_fraction < 0.98:
        raise ValueError(f"representative patch valid-data fraction {valid_fraction:.6f} is below 0.98")

    pixel_to_world: Affine = transform
    x0 = transform.c + (col0 + 0.5) * transform.a
    y0 = transform.f + (row0 + 0.5) * transform.e
    x_max = x0 + patch_pixels * CELL_SIZE_METERS
    y_min = y0 - patch_pixels * CELL_SIZE_METERS
    z_min = math.floor(float(np.nanmin(patch)) / CELL_SIZE_METERS) * CELL_SIZE_METERS - CELL_SIZE_METERS
    z_max = math.ceil(float(np.nanmax(patch)) / CELL_SIZE_METERS) * CELL_SIZE_METERS + CELL_SIZE_METERS
    z_cells = max(1, int(math.ceil((z_max - z_min) / CELL_SIZE_METERS)))

    inverse = ~pixel_to_world

    def height_at(x: float, y: float) -> float:
        col_corner, row_corner = inverse * (x, y)
        col_f, row_f = col_corner - 0.5, row_corner - 0.5
        # Shared cell boundaries can land a few ulps either side of an integer
        # after affine inversion. Snap only within a tiny pixel-space tolerance
        # so adjacent cells sample the identical raster row/column deterministically.
        nearest_col, nearest_row = round(col_f), round(row_f)
        if abs(col_f - nearest_col) <= 1e-6:
            col_f = float(nearest_col)
        if abs(row_f - nearest_row) <= 1e-6:
            row_f = float(nearest_row)
        c0, r0 = math.floor(col_f), math.floor(row_f)
        fx, fy = col_f - c0, row_f - r0
        if r0 < 0 or c0 < 0 or r0 + 1 >= height or c0 + 1 >= width:
            raise ValueError("SDF query left the projected raster extent")
        block = projected[r0:r0 + 2, c0:c0 + 2]
        if block.shape != (2, 2) or not np.isfinite(block).all():
            raise ValueError("SDF query intersects raster NoData; no synthetic elevation is permitted")
        return float(
            block[0, 0] * (1 - fx) * (1 - fy)
            + block[0, 1] * fx * (1 - fy)
            + block[1, 0] * (1 - fx) * fy
            + block[1, 1] * fx * fy
        )

    # One transition face along the west side of a 2.56 km square patch. Cells
    # span the vertical range of the real DEM, so the zero isosurface is terrain.
    meshes: dict[tuple[int, int], list[tuple[float, float, float]]] = {}
    triangles_by_cell: dict[tuple[int, int], list[tuple[int, int, int]]] = {}
    tested_cells = nonempty_cells = skipped_nodata_cells = 0
    all_vertices: list[tuple[float, float, float]] = []
    all_triangles: list[tuple[int, int, int]] = []
    started = time.perf_counter()
    for j in range(patch_pixels):
        y_cell = y_min + j * CELL_SIZE_METERS
        for k in range(z_cells):
            z_cell = z_min + k * CELL_SIZE_METERS

            def sdf(x: float, y: float, z: float) -> float:
                # Canonicalize near-iso values so shared cells cannot classify
                # the same boundary sample with opposite signs due to float32/ulp noise.
                return _stable_sdf_sample(z, height_at(x, y))

            tested_cells += 1
            try:
                vertices, triangles, metadata = mesh_transition_cell(
                    sdf, (x0, y_cell, z_cell), axis=0,
                    extent=CELL_SIZE_METERS, direction=1,
                )
            except ValueError as error:
                if "NoData" in str(error) or "raster extent" in str(error):
                    skipped_nodata_cells += 1
                    continue
                raise
            vertices = [tuple(float(v) for v in point) for point in vertices]
            triangles = [tuple(int(v) for v in tri) for tri in triangles]
            if not vertices and not triangles:
                meshes[(j, k)] = []
                triangles_by_cell[(j, k)] = []
                continue
            if not vertices or not triangles:
                raise AssertionError(f"case {metadata.get('case')} emitted incomplete geometry")
            if any(not math.isfinite(value) for point in vertices for value in point):
                raise AssertionError("mesher emitted a non-finite vertex")
            if any(min(tri) < 0 or max(tri) >= len(vertices) for tri in triangles):
                raise AssertionError("mesher emitted an invalid triangle index")
            nonempty_cells += 1
            meshes[(j, k)] = vertices
            triangles_by_cell[(j, k)] = triangles
            base = len(all_vertices)
            all_vertices.extend(vertices)
            all_triangles.extend(tuple(base + index for index in tri) for tri in triangles)

    seam_pairs_checked = seam_mismatches = 0
    seam_mismatch_examples: list[dict[str, Any]] = []
    for j in range(patch_pixels - 1):
        for k in range(z_cells):
            left = meshes.get((j, k), [])
            right = meshes.get((j + 1, k), [])
            y_boundary = y_min + (j + 1) * CELL_SIZE_METERS
            if left or right:
                seam_pairs_checked += 1
                left_seam = _seam_key(left, 1, y_boundary)
                right_seam = _seam_key(right, 1, y_boundary)
                if left_seam != right_seam:
                    seam_mismatches += 1
                    if len(seam_mismatch_examples) < 10:
                        seam_mismatch_examples.append({
                            "axis": "y", "cells": [[j, k], [j + 1, k]],
                            "boundary": y_boundary, "left": left_seam[:8], "right": right_seam[:8],
                        })
    for j in range(patch_pixels):
        for k in range(z_cells - 1):
            lower = meshes.get((j, k), [])
            upper = meshes.get((j, k + 1), [])
            z_boundary = z_min + (k + 1) * CELL_SIZE_METERS
            if lower or upper:
                seam_pairs_checked += 1
                lower_seam = _seam_key(lower, 2, z_boundary)
                upper_seam = _seam_key(upper, 2, z_boundary)
                if lower_seam != upper_seam:
                    seam_mismatches += 1
                    if len(seam_mismatch_examples) < 10:
                        seam_mismatch_examples.append({
                            "axis": "z", "cells": [[j, k], [j, k + 1]],
                            "boundary": z_boundary, "lower": lower_seam[:8], "upper": upper_seam[:8],
                        })
    elapsed = time.perf_counter() - started
    mesh_digest_payload = json.dumps(
        {"vertices": all_vertices, "triangles": all_triangles},
        separators=(",", ":"), allow_nan=False,
    ).encode("utf-8")
    report = {
        "schemaVersion": "1.0.0",
        "evidenceStatus": "REAL_DEM_TRANSVOXEL_BENCHMARK",
        "benchmarkScope": "bounded real-DEM transition face; not full adaptive-octree terrain extraction",
        "source": {
            "rasterPath": raster_path.name,
            "rasterSha256": raster_hash,
            "acquisitionEvidencePath": evidence_path.name,
            "acquisitionEvidenceSha256": sha256_bytes(evidence_path.read_bytes()),
            "sourceAoiId": evidence.get("aoi", {}).get("id"),
            "aoiApprovalStatus": approval,
            "sourceVerticalDatum": usgs_source.get("verticalDatum", "UNRESOLVED"),
            "sourceAccuracyClass": usgs_source.get("accuracyClass", "UNRESOLVED"),
            "sourceAcquisitionVintage": usgs_source.get("acquisitionVintage", "NOT_REPORTED_BY_DYNAMIC_MOSAIC"),
            "verticalCoordinateUnitsUsedForScreening": "meters",
            "verticalUnitsBasis": "USGS National Map Seamless DEM Specifications; source-item-specific unit/datum is not certified by this dynamic mosaic export",
            "verticalUnitsBasisUrl": "https://pubs.usgs.gov/tm/11b9/tm11B9.pdf",
        },
        "projection": {"sourceCrs": str(src_crs), "benchmarkCrs": TARGET_CRS, "cellSizeMeters": CELL_SIZE_METERS},
        "patch": {
            "widthCells": patch_pixels, "heightCells": patch_pixels,
            "boundsMeters": [x0, y_min, x_max, y0],
            "elevationMinMeters": float(np.nanmin(patch)),
            "elevationMaxMeters": float(np.nanmax(patch)),
            "validDataFraction": valid_fraction,
            "transitionCellsTested": tested_cells,
            "transitionCellsMeshed": nonempty_cells,
            "cellsSkippedForNoData": skipped_nodata_cells,
        },
        "mesh": {
            "vertexCount": len(all_vertices),
            "triangleCount": len(all_triangles),
            "sha256": sha256_bytes(mesh_digest_payload),
            "seamPairsChecked": seam_pairs_checked,
            "seamMismatches": seam_mismatches,
            "seamToleranceMeters": SEAM_TOLERANCE_METERS,
            "seamMismatchExamples": seam_mismatch_examples,
        },
        "performance": {
            "wallTimeSeconds": elapsed,
            "processPeakRssBytes": _rss_bytes(),
            "measurement": "actual Python process on the GitHub Actions runner; not a physical-GPU measurement",
        },
        "limitations": [
            "The AOI is an unapproved ZIP/county screening polygon, not a parcel or watershed.",
            "The benchmark uses meters vertically under the USGS National Map seamless-DEM specification as a screening assumption; source-item-specific unit, acquisition vintage, vertical datum, and accuracy are not certified by this dynamic mosaic export.",
            "This benchmark meshes the real DEM-derived implicit surface only along one bounded transition face; it is not a full terrain meshing pipeline.",
            "Seam checks cover adjacent transition cells in this bounded face only, not all six orientations or inter-tile adaptive octree seams.",
        ],
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if seam_mismatches:
        print(json.dumps(report, indent=2, sort_keys=True), flush=True)
        raise RuntimeError(f"real-DEM transition seam validation failed: {seam_mismatches}/{seam_pairs_checked} pairs mismatched; see seamMismatchExamples above")
    if nonempty_cells == 0 or len(all_triangles) == 0:
        raise RuntimeError("real-DEM benchmark produced no terrain triangles")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raster", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--patch-pixels", type=int, default=PATCH_PIXELS)
    args = parser.parse_args()
    if not 32 <= args.patch_pixels <= 512:
        parser.error("--patch-pixels must be in 32..512")
    report = run_benchmark(args.raster, args.evidence, args.output, args.patch_pixels)
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
