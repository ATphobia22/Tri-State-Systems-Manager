#!/usr/bin/env python3
"""TSM geodetic conversion library: NAVD88 / GEOID18 / ECEF handling.

Correct vertical chain (per NOAA NGS, research-validated 2026-10-07):

    EPSG:2966 X/Y (NAD83 Indiana West, US survey ft)
        |
        v
    NAD83 geographic lon/lat (EPSG:4269)
        |
        +-- NAVD88 orthometric height H (meters or feet, EXPLICIT)
        |
        v
    GEOID18 geoid separation N  (h = H + N ; H = h - N)
        |
        v
    WGS84 ellipsoidal height h
        |
        v
    WGS84 ECEF (X, Y, Z)

The geodetically INCORRECT shortcut this replaces is passing a NAVD88
orthometric height directly into an ECEF surface function as if it were
an ellipsoidal height. In the Posey County area the GEOID18 separation is
roughly -33 m, so the shortcut misplaces every vertex by ~100 ft vertically.

Rules enforced here:
  * Every elevation value must carry an explicit vertical datum label.
  * Silent vertical-datum conversion is REJECTED (raises VerticalDatumError).
  * The regional GEOID18 approximation is labeled APPROXIMATE and must be
    replaced with the actual GEOID18 grid for production engineering use.
  * US survey feet vs international feet are distinguished explicitly.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

try:
    from pyproj import Transformer
    _HAS_PYPROJ = True
except ImportError:  # pragma: no cover
    _HAS_PYPROJ = False

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

WGS84_A = 6378137.0
WGS84_F = 1.0 / 298.257223563
WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F

US_SURVEY_FT_TO_M = 1200.0 / 3937.0   # exact definition
INTL_FT_TO_M = 0.3048

# GEOID18 geoid separation for the Posey County, IN area (~37.8 N, ~88.0 W).
# APPROXIMATE regional value. NOAA GEOID18 in southern Indiana runs about
# -32 m to -35 m (geoid below ellipsoid). This constant is a documented
# placeholder for the area; production engineering work MUST supply the
# actual GEOID18 grid via GeoidModel.from_grid_file().
GEOID18_POSEY_REGIONAL_APPROX_M = -33.5
GEOID18_POSEY_APPROX_NOTE = (
    "APPROXIMATE regional GEOID18 separation for Posey County, IN "
    "(~37.8N, ~88.0W). Replace with the NOAA GEOID18 grid for production use."
)

EPSG_IN_WEST = "EPSG:2966"     # NAD83 / Indiana West (ftUS)
EPSG_NAD83_GEO = "EPSG:4269"   # NAD83 geographic
EPSG_WGS84_GEO = "EPSG:4326"   # WGS84 geographic


class VerticalDatumError(ValueError):
    """Raised when a vertical datum is missing, ambiguous, or silently converted."""


@dataclass(frozen=True)
class Elevation:
    """An elevation value with explicit datum and unit metadata.

    No silent conversion: to change datum or unit, call an explicit method.
    """
    value: float
    unit: str            # "ftUS" | "m"
    vertical_datum: str   # "NAVD88" | "ELLIPSOIDAL_WGS84" | ...

    def __post_init__(self):
        if self.unit not in ("ftUS", "m", "ft"):
            raise VerticalDatumError(f"unknown unit {self.unit!r}; use 'ftUS' or 'm'")
        if not self.vertical_datum:
            raise VerticalDatumError("vertical_datum is required; refusing unlabeled elevation")
        if not math.isfinite(self.value):
            raise VerticalDatumError(f"non-finite elevation value {self.value!r}")

    def to_meters(self) -> "Elevation":
        if self.unit == "m":
            return self
        factor = US_SURVEY_FT_TO_M if self.unit == "ftUS" else INTL_FT_TO_M
        return Elevation(self.value * factor, "m", self.vertical_datum)

    def to_ftUS(self) -> "Elevation":
        if self.unit == "ftUS":
            return self
        m = self.to_meters().value
        return Elevation(m / US_SURVEY_FT_TO_M, "ftUS", self.vertical_datum)


class GeoidModel:
    """GEOID18 geoid separation N lookup.

    h (ellipsoidal) = H (orthometric NAVD88) + N (geoid separation).
    """

    def __init__(self, regional_approx_m: float = GEOID18_POSEY_REGIONAL_APPROX_M,
                 approximate: bool = True, note: str = GEOID18_POSEY_APPROX_NOTE):
        self._n = regional_approx_m
        self.approximate = approximate
        self.note = note

    @classmethod
    def from_grid_file(cls, path: str) -> "GeoidModel":
        """Load a real GEOID18 grid. Not yet implemented: wire to a grid
        reader (e.g. NOAA .bin via pyproj vertical grids) when available."""
        raise NotImplementedError(
            "GEOID18 grid-file loading is not yet implemented; supply the grid "
            f"reader for {path}. Using the regional approximation instead."
        )

    def separation_m(self, lon_deg: float, lat_deg: float) -> tuple[float, bool]:
        """Return (N_meters, is_approximate)."""
        return self._n, self.approximate


def _require_pyproj():
    if not _HAS_PYPROJ:
        raise ImportError("pyproj is required for horizontal CRS transforms")


def in_west_to_nad83_lonlat(x_ftus: float, y_ftus: float) -> tuple[float, float]:
    """EPSG:2966 (NAD83 Indiana West, US ft) -> NAD83 lon/lat degrees."""
    _require_pyproj()
    t = Transformer.from_crs(EPSG_IN_WEST, EPSG_NAD83_GEO, always_xy=True)
    return t.transform(x_ftus, y_ftus)


def nad83_to_wgs84_lonlat(lon_deg: float, lat_deg: float) -> tuple[float, float]:
    """NAD83 geographic -> WGS84 geographic. Null transform at this accuracy;
    kept explicit so the datum step is never skipped silently."""
    _require_pyproj()
    t = Transformer.from_crs(EPSG_NAD83_GEO, EPSG_WGS84_GEO, always_xy=True)
    return t.transform(lon_deg, lat_deg)


def orthometric_to_ellipsoidal(h_orth: Elevation, geoid: GeoidModel,
                               lon_deg: float, lat_deg: float) -> tuple[Elevation, bool]:
    """Apply h = H + N. Requires h_orth.vertical_datum == 'NAVD88'."""
    if h_orth.vertical_datum != "NAVD88":
        raise VerticalDatumError(
            f"orthometric_to_ellipsoidal requires NAVD88 input, got "
            f"{h_orth.vertical_datum!r}; refusing silent datum assumption"
        )
    n_m, approx = geoid.separation_m(lon_deg, lat_deg)
    h_m = h_orth.to_meters().value
    ellipsoidal_m = h_m + n_m
    return Elevation(ellipsoidal_m, "m", "ELLIPSOIDAL_WGS84"), approx


def ellipsoidal_to_ecef(lon_deg: float, lat_deg: float, h_m: float) -> tuple[float, float, float]:
    """WGS84 geographic + ellipsoidal height -> ECEF meters."""
    lon, lat = math.radians(lon_deg), math.radians(lat_deg)
    s, c = math.sin(lat), math.cos(lat)
    n = WGS84_A / math.sqrt(1.0 - WGS84_E2 * s * s)
    return (
        (n + h_m) * c * math.cos(lon),
        (n + h_m) * c * math.sin(lon),
        (n * (1.0 - WGS84_E2) + h_m) * s,
    )


def wgs84_navd88_to_ecef(lon_deg: float, lat_deg: float, h_navd88: Elevation,
                         geoid: GeoidModel | None = None) -> dict:
    """WGS84 lon/lat + NAVD88 orthometric -> WGS84 ECEF.

    Same h = H + N chain as navd88_to_ecef but starting from geographic
    coordinates instead of EPSG:2966. For tile builders whose footprints
    are already in lon/lat.
    """
    if h_navd88.vertical_datum != "NAVD88":
        raise VerticalDatumError(
            f"wgs84_navd88_to_ecef requires NAVD88 orthometric height, got "
            f"{h_navd88.vertical_datum!r}"
        )
    geoid = geoid or GeoidModel()
    h_ellip, geoid_approx = orthometric_to_ellipsoidal(h_navd88, geoid, lon_deg, lat_deg)
    ecef = ellipsoidal_to_ecef(lon_deg, lat_deg, h_ellip.value)
    return {
        "ecef_m": ecef,
        "ellipsoidal_m": h_ellip.value,
        "orthometric_m": h_navd88.to_meters().value,
        "geoid_separation_m": h_ellip.value - h_navd88.to_meters().value,
        "geoid_approximate": geoid_approx,
        "geoid_note": geoid.note if geoid_approx else "GEOID18 grid",
        "vertical_datum_in": "NAVD88",
    }


def navd88_to_ecef(x_ftus: float, y_ftus: float, h_navd88: Elevation,
                   geoid: GeoidModel | None = None) -> dict:
    """Full correct chain: EPSG:2966 + NAVD88 orthometric -> WGS84 ECEF.

    Returns a dict with every intermediate value and provenance flags so
    callers can record exactly what transformation was applied.
    """
    if h_navd88.vertical_datum != "NAVD88":
        raise VerticalDatumError(
            f"navd88_to_ecef requires NAVD88 orthometric height, got "
            f"{h_navd88.vertical_datum!r}"
        )
    geoid = geoid or GeoidModel()
    lon_nad83, lat_nad83 = in_west_to_nad83_lonlat(x_ftus, y_ftus)
    lon_wgs84, lat_wgs84 = nad83_to_wgs84_lonlat(lon_nad83, lat_nad83)
    h_ellip, geoid_approx = orthometric_to_ellipsoidal(h_navd88, geoid, lon_wgs84, lat_wgs84)
    ecef = ellipsoidal_to_ecef(lon_wgs84, lat_wgs84, h_ellip.value)
    return {
        "ecef_m": ecef,
        "lon_nad83_deg": lon_nad83,
        "lat_nad83_deg": lat_nad83,
        "lon_wgs84_deg": lon_wgs84,
        "lat_wgs84_deg": lat_wgs84,
        "orthometric_m": h_navd88.to_meters().value,
        "ellipsoidal_m": h_ellip.value,
        "geoid_separation_m": h_ellip.value - h_navd88.to_meters().value,
        "geoid_approximate": geoid_approx,
        "geoid_note": geoid.note if geoid_approx else "GEOID18 grid",
        "horizontal_crs": EPSG_IN_WEST,
        "vertical_datum_in": "NAVD88",
    }


def enu_basis(lon_deg: float, lat_deg: float):
    """East-North-Up basis vectors at a WGS84 location (for tile-local frames)."""
    lon, lat = math.radians(lon_deg), math.radians(lat_deg)
    return (
        (-math.sin(lon), math.cos(lon), 0.0),
        (-math.sin(lat) * math.cos(lon), -math.sin(lat) * math.cos(lon), math.cos(lat)),
        (math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)),
    )
