#!/usr/bin/env python3
"""Inspect an Indiana DEM ImageServer TIFF export without asserting Z datum.

A shaded-render image, arbitrary TIFF, misprojected raster, corrupt resume, or
all-nodata tile cannot be promoted as an accepted local elevation raster.
"""
from __future__ import annotations

import hashlib
import math
from pathlib import Path

import numpy as np
import rasterio

TIFF_HEADERS = (b"II*\x00", b"MM\x00*", b"II+\x00", b"MM\x00+")
MAX_TILE_BYTES = 512 * 1024 * 1024


def inspect_export(path: Path, *, bbox_3857: tuple[float, float, float, float],
                   width: int, height: int) -> dict:
    """Validate TIFF raster framing and collect a reproducible byte-level receipt.

    The returned verdict is ONLY local export structural integrity; producer
    source datum, vertical units, original resolution and accuracy are unknown.
    """
    if path.is_symlink() or not path.is_file():
        raise ValueError("DEM export is missing or symlinked")
    size = path.stat().st_size
    if size < 8 or size > MAX_TILE_BYTES:
        raise ValueError("DEM export file size is invalid or exceeds limit")
    with path.open("rb") as fh:
        if fh.read(4) not in TIFF_HEADERS:
            raise ValueError("not a supported classic/BigTIFF header")
    if type(width) is not int or type(height) is not int or not (1 <= width <= 2048 and 1 <= height <= 2048):
        raise ValueError("invalid expected raster dimensions")
    if (len(bbox_3857) != 4 or not all(isinstance(v, (int, float)) and not isinstance(v, bool)
            and math.isfinite(v) for v in bbox_3857)):
        raise ValueError("invalid expected raster bounds")
    xmin, ymin, xmax, ymax = bbox_3857
    if not xmin < xmax or not ymin < ymax:
        raise ValueError("invalid expected raster bounds")
    try:
        with rasterio.open(path) as ds:
            if ds.driver not in ("GTiff", "COG") or ds.count != 1 or ds.dtypes[0] != "float32":
                raise ValueError("DEM export must be one-band float32 GeoTIFF, not rendered hillshade")
            if ds.crs is None or ds.crs.to_epsg() != 3857:
                raise ValueError("DEM export has wrong or absent EPSG:3857 horizontal CRS")
            if ds.width != width or ds.height != height:
                raise ValueError("DEM export dimensions disagree with requested export")
            target = (xmin, ymin, xmax, ymax)
            actual = (ds.bounds.left, ds.bounds.bottom, ds.bounds.right, ds.bounds.top)
            tolerance = max(abs(ds.res[0]), abs(ds.res[1]), 1e-6) * 0.51
            if any(abs(a - b) > tolerance for a, b in zip(actual, target)):
                raise ValueError("DEM export bounds disagree with requested export")
            array = ds.read(1, masked=True)
            count = int(np.count_nonzero(np.isfinite(np.ma.filled(array, np.nan))))
            if count == 0:
                raise ValueError("DEM export contains no valid finite elevation pixels")
            digest = hashlib.sha256()
            with path.open("rb") as fh:
                for block in iter(lambda: fh.read(1024 * 1024), b""):
                    digest.update(block)
            return {
                "bytes": size, "sha256": digest.hexdigest(),
                "epsg": 3857, "bands": 1, "pixelType": "float32",
                "width": width, "height": height, "validFinitePixelCount": count,
                "localExportStructureVerified": True,
                "sourceNativeRasterResolutionVerified": False,
                "sourceVerticalDatumVerified": False,
                "sourceElevationUnitsVerified": False,
                "surveyAccuracyVerified": False,
            }
    except rasterio.errors.RasterioError as exc:
        raise ValueError("DEM export failed raster decode") from exc
