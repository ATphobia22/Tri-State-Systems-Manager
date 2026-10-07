#!/usr/bin/env python3
"""Strict NAD83(2011)/NAVD88 geodesy for TSM building geometry.

No WGS84/ballpark fallback is permitted. GEOID18 is the vertical model and
must be installed in PROJ's data path before this module is used.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from pyproj import Transformer


@dataclass(frozen=True)
class EcefPoint:
    x: float
    y: float
    z: float
    lon_deg: float
    lat_deg: float
    ellipsoid_height_m: float
    geoid_height_m: float


def _finite(*values: float) -> bool:
    return all(math.isfinite(float(v)) for v in values)



def _from_nad83_2011_lonlat(lon: float, lat: float, orthometric_height_ft: float) -> EcefPoint:
    vertical = Transformer.from_crs("EPSG:5703", "EPSG:6319", always_xy=True, allow_ballpark=False)
    _, _, ellipsoid_m = vertical.transform(lon, lat, float(orthometric_height_ft) * 0.3048)
    if not _finite(ellipsoid_m):
        raise ValueError("NAVD88->NAD83(2011) vertical transformation failed")
    ecef = Transformer.from_crs("EPSG:6319", "EPSG:4978", always_xy=True, allow_ballpark=False)
    ex, ey, ez = ecef.transform(lon, lat, ellipsoid_m)
    if not _finite(ex, ey, ez):
        raise ValueError("ECEF transformation produced non-finite coordinates")
    return EcefPoint(float(ex), float(ey), float(ez), float(lon), float(lat), float(ellipsoid_m), float(ellipsoid_m - orthometric_height_ft * 0.3048))


def navd88_lonlat_to_ecef(lon_deg: float, lat_deg: float, orthometric_height_ft: float) -> EcefPoint:
    if not _finite(lon_deg, lat_deg, orthometric_height_ft):
        raise ValueError("non-finite geodetic input")
    horizontal = Transformer.from_crs("EPSG:4326", "EPSG:6318", always_xy=True, allow_ballpark=False)
    lon, lat = horizontal.transform(float(lon_deg), float(lat_deg))
    return _from_nad83_2011_lonlat(float(lon), float(lat), float(orthometric_height_ft))

def navd88_to_ecef(x_ft: float, y_ft: float, orthometric_height_ft: float) -> EcefPoint:
    """Convert EPSG:2966 + NAVD88 to NAD83(2011) ellipsoid/ECEF.

    Requires PROJ to have the official GEOID18 grid available. Transformer
    construction is deliberately fail-closed: no ballpark transformation,
    WGS84 substitution, or approximate geoid is accepted.
    """
    if not _finite(x_ft, y_ft, orthometric_height_ft):
        raise ValueError("non-finite geodetic input")
    xy = Transformer.from_crs(
        "EPSG:2966", "EPSG:6318", always_xy=True, allow_ballpark=False
    )
    lon, lat = xy.transform(float(x_ft), float(y_ft))
    if not _finite(lon, lat):
        raise ValueError("horizontal transformation produced non-finite coordinates")

    return _from_nad83_2011_lonlat(float(lon), float(lat), float(orthometric_height_ft))
