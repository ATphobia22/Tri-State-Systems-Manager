#!/usr/bin/env python3
"""Compare explicit building base vertices with a decoded elevation raster.

Diagnostic only: never snaps vertices, generates missing geometry, certifies LoD,
or treats a declared datum as independently verified. GDAL transform order is
(x_origin, pixel_x, row_x, y_origin, pixel_y, row_y), using pixel CORNERS.
Sampling uses the containing cell, without interpolation or edge clamping.
Tolerance is a caller-selected comparison policy, not a source accuracy claim.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np


def _finite(value):
    return isinstance(value, (int, float, np.number)) and not isinstance(value, (bool, np.bool_)) and math.isfinite(value)


def verify_terrain_alignment(vertices, terrain, transform, *, mesh_metadata,
                             terrain_metadata, tolerance_m, nodata=None):
    """Compare same-frame metres; incomplete evidence never counts as aligned.

    This is a base-contact diagnostic, not a universal building conformity rule:
    bridges, foundations, basements and stepped slabs may legitimately differ
    from a DTM. Input vertices must identify the actual intended contact points.
    """
    if not _finite(tolerance_m) or tolerance_m < 0:
        raise ValueError("tolerance_m must be a finite nonnegative explicit policy")
    grid = np.ma.asarray(terrain)
    if grid.ndim != 2 or 0 in grid.shape or grid.dtype.kind not in "fiu":
        raise ValueError("decoded numeric single-band elevation raster required, not Terrain-RGB")
    if len(transform) != 6 or not all(_finite(x) for x in transform):
        raise ValueError("six finite GDAL affine coefficients required")
    x0, a, b, y0, d, e = map(float, transform)
    matrix = np.array([[a, b], [d, e]], dtype=float)
    scale = float(np.max(np.abs(matrix)))
    if scale == 0 or not math.isfinite(float(np.linalg.cond(matrix))) or np.linalg.cond(matrix) > 1e12:
        raise ValueError("singular or ill-conditioned affine transform")
    # Inversion of the full 2x2 handles north-up, rotation and shear.
    inverse = np.linalg.inv(matrix)
    if not np.isfinite(inverse).all():
        raise ValueError("nonfinite affine inverse")
    if not isinstance(vertices, list):
        raise ValueError("vertices must be an explicit list")
    for v in vertices:
        if not isinstance(v, dict) or type(v.get("is_base")) is not bool or not all(_finite(v.get(k)) for k in ("x", "y", "z")):
            raise ValueError("every vertex needs finite x/y/z and boolean is_base")
    result = {"schema": "tsm.lod-terrain-alignment.v1", "status": "incomplete",
              "is_valid": False, "lod_certified": False, "geometry_modified": False,
              "datum_independently_verified": False, "tolerance_m": float(tolerance_m),
              "sampling": "containing-cell-no-interpolation", "checked_base_vertices": 0,
              "base_vertex_count": sum(v["is_base"] for v in vertices),
              "total_violations": 0, "violations": [], "unavailable": [],
              "issues": [], "rmse_m": None, "max_abs_delta_m": None}
    for key in ("crs", "vertical_datum", "vertical_units"):
        left = mesh_metadata.get(key) if isinstance(mesh_metadata, dict) else None
        right = terrain_metadata.get(key) if isinstance(terrain_metadata, dict) else None
        if (not isinstance(left, str) or not left.strip() or
            left.strip().upper() in {"UNVERIFIED", "UNKNOWN", "UNSPECIFIED", "NONE"} or left != right):
            result["issues"].append(f"MISSING_OR_MISMATCHED_{key.upper()}")
    if not isinstance(mesh_metadata, dict) or mesh_metadata.get("vertical_units") != "m":
        result["issues"].append("DECODED_METRE_ELEVATIONS_REQUIRED")
    if result["issues"]:
        return result
    if not result["base_vertex_count"]:
        result["issues"].append("NO_BASE_CONTACT_EVIDENCE")
        return result
    residuals = []
    for index, v in enumerate(vertices):
        if not v["is_base"]:
            continue
        with np.errstate(over="ignore", invalid="ignore"):
            pixel = inverse @ np.array([v["x"] - x0, v["y"] - y0])
        if not np.isfinite(pixel).all() or not (0 <= pixel[0] < grid.shape[1] and 0 <= pixel[1] < grid.shape[0]):
            result["unavailable"].append({"vertex_index": index, "reason": "OUT_OF_BOUNDS"})
            continue
        col, row = math.floor(pixel[0]), math.floor(pixel[1])
        sample = grid[row, col]
        if np.ma.is_masked(sample) or not math.isfinite(float(sample)) or (nodata is not None and sample == nodata):
            result["unavailable"].append({"vertex_index": index, "reason": "NODATA"})
            continue
        delta = v["z"] - float(sample)
        if not math.isfinite(delta):
            result["unavailable"].append({"vertex_index": index, "reason": "NONFINITE_DELTA"})
            continue
        residuals.append(delta)
        if abs(delta) > tolerance_m:
            result["violations"].append({"vertex_index": index, "coord": [v["x"], v["y"]],
                                         "mesh_z_m": v["z"], "terrain_z_m": float(sample),
                                         "signed_delta_m": delta, "delta_m": abs(delta)})
    result["checked_base_vertices"] = len(residuals)
    result["total_violations"] = len(result["violations"])
    if residuals:
        result["max_abs_delta_m"] = max(abs(x) for x in residuals)
        root_count = math.sqrt(len(residuals))
        result["rmse_m"] = math.hypot(*(x / root_count for x in residuals))
    if result["unavailable"]:
        result["status"] = "incomplete"
    elif result["violations"]:
        result["status"] = "mismatch"
    else:
        result["status"] = "aligned"
        result["is_valid"] = True
    return result


def _sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mesh-document", type=Path, required=True,
                        help="JSON with vertices, mesh_metadata, terrain_metadata and terrain_sha256")
    parser.add_argument("--terrain", type=Path, required=True, help="decoded single-band elevation GeoTIFF")
    parser.add_argument("--tolerance-m", type=float, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args(argv)
    # Missing dependencies or inputs affect this command only, never the viewer.
    try:
        import rasterio
        document = json.loads(args.mesh_document.read_text())
        if not isinstance(document, dict):
            raise ValueError("MESH_DOCUMENT_OBJECT_REQUIRED")
        raster_hash = _sha256(args.terrain)
        if document.get("terrain_sha256") != raster_hash:
            raise ValueError("TERRAIN_SHA256_MISMATCH_OR_MISSING")
        with rasterio.open(args.terrain) as dataset:
            if dataset.count != 1 or dataset.crs is None:
                raise ValueError("SINGLE_BAND_GEOREFERENCED_ELEVATION_REQUIRED")
            if dataset.scales[0] != 1 or dataset.offsets[0] != 0:
                raise ValueError("DECODE_RASTER_SCALE_AND_OFFSET_TO_METRES_FIRST")
            declared = document.get("terrain_metadata", {})
            if not isinstance(declared, dict) or declared.get("crs") != dataset.crs.to_string():
                raise ValueError("TERRAIN_CRS_DECLARATION_MISMATCH")
            report = verify_terrain_alignment(document.get("vertices"), dataset.read(1, masked=True),
                dataset.transform.to_gdal(), mesh_metadata=document.get("mesh_metadata"),
                terrain_metadata=declared, tolerance_m=args.tolerance_m, nodata=dataset.nodata)
        report["input_sha256"] = {"terrain": raster_hash, "mesh_document": _sha256(args.mesh_document)}
    except (ImportError, ValueError, TypeError, OSError, KeyError) as exc:
        report = {"schema": "tsm.lod-terrain-alignment.v1", "status": "incomplete",
                  "is_valid": False, "lod_certified": False, "geometry_modified": False,
                  "issues": [str(exc)]}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    return 0 if report["is_valid"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
