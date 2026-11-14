#!/usr/bin/env python3
"""Strict-evidence LAS/LAZ -> H3 v4 -> global ECEF OGC bounding-box manifest.

Input must have declared horizontal+vertical CRS; source Z is NEVER assumed
to be an ellipsoidal elevation. Requires full 3D PROJ transformation into
WGS84 EPSG:4979. Refuses unavailable grid shifts and ballpark operations.
The manifest is a spatial QA artifact, not a complete 3D Tiles tileset.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
from collections import defaultdict

import numpy as np

# Allow direct execution as `python scripts/geospatial/tsm_lidar_h3_obb.py`
# from the repo root (and from anywhere) without PYTHONPATH: the module
# below is imported by absolute package path, so the repo root must be on
# sys.path. `python -m scripts.geospatial.tsm_lidar_h3_obb` also works.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.geospatial.tsm_math_engine import TSMMathEngine as E


def is_geographic_3d(crs) -> bool:
    """True exactly for 3D geographic CRSs (e.g. EPSG:4979).

    pyproj's CRS has no ``is_geographic_3d`` attribute (verified on pyproj
    3.8.0); a geographic CRS is 3D exactly when it carries three axes.
    ``is_geographic`` alone would wrongly accept 2D EPSG:4326, so the axis
    count is the discriminator. A projected 3D CRS is NOT accepted here:
    the script's contract is geographic-3D, geocentric, or compound input.
    """
    return bool(crs.is_geographic) and len(crs.axis_info) == 3


def require_3d_source_crs(source_crs: str):
    """Parse and gate a source CRS: it must explicitly encode horizontal AND
    vertical datums — compound, geographic 3D, or geocentric. A 2D CRS
    (e.g. EPSG:4326, EPSG:3857) raises ValueError instead of being silently
    treated as ellipsoidal height. Split out of run() so the gate is unit
    testable without a LAS file or laspy."""
    from pyproj import CRS

    crs = CRS.from_user_input(source_crs)
    if not crs.is_compound and not is_geographic_3d(crs) and not crs.is_geocentric:
        raise ValueError("Source CRS must explicitly encode horizontal AND vertical datums")
    return crs


def run(source: Path, source_crs: str, resolution: int, output: Path,
        max_points: int = 2_000_000) -> dict:
    from pyproj import CRS, Transformer

    if not source.is_file():
        raise FileNotFoundError(source)
    if not 0 <= resolution <= 15:
        raise ValueError("H3 resolution must be in [0, 15]")
    if max_points < 1:
        raise ValueError("max_points must be positive")
    crs = require_3d_source_crs(source_crs)
    import h3
    import laspy
    # allow_ballpark=False blocks unsupported datum substitutions; only_best
    # raises when high-accuracy operations or required transformation grids are unavailable.
    transform = Transformer.from_crs(crs, CRS.from_epsg(4979),
                                     always_xy=True, allow_ballpark=False, only_best=True)
    cells = defaultdict(list)
    digest = hashlib.sha256()
    count = 0
    with source.open("rb") as binary:
        for block in iter(lambda: binary.read(1024 * 1024), b""):
            digest.update(block)
    with laspy.open(source) as handle:
        for chunk in handle.chunk_iterator(200_000):
            n = len(chunk.x)
            if count + n > max_points:
                raise ValueError("Point count exceeds explicit safety cap")
            count += n
            lon, lat, h = transform.transform(np.asarray(chunk.x), np.asarray(chunk.y),
                                               np.asarray(chunk.z), errcheck=True)
            for a, b, height in zip(lat, lon, h):
                if not all(math.isfinite(float(v)) for v in (a, b, height)):
                    raise ValueError("Nonfinite datum transform result")
                cell = h3.latlng_to_cell(float(a), float(b), resolution)
                cells[cell].append(E.geodetic_to_ecef(float(a), float(b), float(height)))
    if count == 0:
        raise ValueError("LAS/LAZ contains no points")
    bins = {}
    for cell, xyz in sorted(cells.items()):
        bounds = E.compute_oriented_bounding_box(np.asarray(xyz))
        bins[cell] = {"point_count": len(xyz),
                      "ogc_3d_tiles_box": bounds["ogc_3d_tiles_box"],
                      "center_ecef": bounds["center"],
                      "half_extents_m": bounds["half_extents"]}
    result = {
        "schema_version": "1.0.0",
        "artifact_type": "TSM_H3_ECEF_OBB_QA",
        "source_name": source.name,
        "source_sha256": digest.hexdigest(),
        "source_crs_wkt": crs.to_wkt(),
        "destination_crs": "EPSG:4979 -> EPSG:4978",
        "coordinate_operation": transform.description,
        "h3_library_version": getattr(h3, "__version__", "unknown"),
        "h3_resolution": resolution,
        "total_points": count,
        "total_h3_cells": len(bins),
        "h3_bins": bins,
        "caution": "Bounding volumes are ECEF meters; no local tile.transform may be applied twice."
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--laz", required=True, type=Path)
    parser.add_argument("--source-crs", required=True,
                        help="Explicit compound 3D CRS, e.g. EPSG:2966+5703 when verified")
    parser.add_argument("--resolution", type=int, default=9)
    parser.add_argument("--max-points", type=int, default=2_000_000)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    report = run(args.laz, args.source_crs, args.resolution, args.output, args.max_points)
    print(json.dumps({key: report[key] for key in ("source_sha256","total_points","total_h3_cells")}))


if __name__ == "__main__":
    main()
