#!/usr/bin/env python3
"""Compare DEM pixel sizes in ground metres, not mixed CRS coordinate units.

This helper is only for choosing the finest available raster. It is not a
vertical datum transformation or a substitute for source metadata verification.
"""
from __future__ import annotations

import math
from typing import Any


class RasterResolutionError(ValueError):
    """DEM pixel size cannot be compared safely."""


def ground_pixel_resolution_m(crs: Any, pixel_size: tuple[float, float], bounds: Any) -> float:
    """Conservative pixel-spacing estimate in metres for Posey DEM ranking.

    Projected CRSs use the horizontal CRS's linear unit conversion. Geographic
    CRSs use latitude-adjusted degree lengths at the tile centre. Comparisons
    are approximate rankings, not survey-grade distance measurements.
    """
    if crs is None:
        raise RasterResolutionError("DEM is missing its horizontal CRS")
    if len(pixel_size) != 2 or not all(
        isinstance(v, (float, int)) and not isinstance(v, bool)
        and math.isfinite(v) and v > 0 for v in pixel_size
    ):
        raise RasterResolutionError("DEM pixel size must contain two positive finite values")
    dx, dy = pixel_size
    if crs.is_projected:
        unit = crs.linear_units_factor
        if (not isinstance(unit, tuple) or len(unit) != 2 or
            not isinstance(unit[1], (float, int)) or isinstance(unit[1], bool) or
            not math.isfinite(unit[1]) or unit[1] <= 0):
            raise RasterResolutionError("Projected DEM has no usable linear unit conversion")
        resolution = max(dx, dy) * unit[1]
    elif crs.is_geographic:
        lat = (bounds.bottom + bounds.top) / 2.0
        if not math.isfinite(lat) or not -90.0 < lat < 90.0:
            raise RasterResolutionError("Geographic DEM latitude is not finite and plausible")
        phi = math.radians(lat)
        meters_per_degree_lat = (111132.92 - 559.82 * math.cos(2 * phi) +
                                 1.175 * math.cos(4 * phi))
        meters_per_degree_lon = (111412.84 * math.cos(phi) -
                                 93.5 * math.cos(3 * phi))
        resolution = max(dx * meters_per_degree_lon, dy * meters_per_degree_lat)
    else:
        raise RasterResolutionError("DEM CRS is neither projected nor geographic")
    if not math.isfinite(resolution) or resolution <= 0:
        raise RasterResolutionError("DEM ground pixel spacing is invalid")
    return float(resolution)
