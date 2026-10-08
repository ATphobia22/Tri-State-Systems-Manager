#!/usr/bin/env python3
"""TSM geodetic conversion library: NAVD88 / GEOID18 / ECEF handling.

Correct vertical chain (per NOAA NGS):

    EPSG:2966 X/Y (NAD83 Indiana West, US survey ft)
        |
        v
    NAD83 geographic lon/lat (EPSG:4269)
        |
        +-- NAVD88 orthometric height H (meters or feet, EXPLICIT)
        |
        v
    GEOID18 geoid separation N  (h = H + N ; H = h - N)
        |   sampled by bilinear interpolation from the official
        |   NGS GEOID18 CONUS binary grid (g2018u0.bin, Big-Endian)
        v
    WGS84 ellipsoidal height h
        |
        v
    WGS84 ECEF (X, Y, Z)

The geodetically INCORRECT shortcut this replaces is passing a NAVD88
orthometric height directly into an ECEF surface function as if it were
an ellipsoidal height. In the Posey County area the GEOID18 separation is
about -30.3 m, so the shortcut misplaces every vertex by ~100 ft vertically.

Rules enforced here:
  * Every elevation value must carry an explicit vertical datum label.
  * Silent vertical-datum conversion is REJECTED (raises VerticalDatumError).
  * Every geoid separation N comes from the real GEOID18 grid via bilinear
    interpolation. There are NO regional constants and NO approximations.
  * If the grid file is missing or a coordinate falls outside CONUS coverage,
    this module FAILS CLOSED (raises) rather than substituting a constant.
  * US survey feet vs international feet are distinguished explicitly.
"""

from __future__ import annotations

import math
import struct
from dataclasses import dataclass
from pathlib import Path

import numpy as np

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

# Official NGS GEOID18 CONUS grid (Big-Endian unix format).
# Downloaded from https://www.ngs.noaa.gov/GEOID/GEOID18/downloads.shtml
# NOTE: the Little-Endian "pc" build had decimeter-level errors; the
# Big-Endian "unix" build (used here) is the correct one.
GEOID18_GRID_FILENAME = "g2018u0.bin"
GEOID18_GRID_SHA256 = "c41654f1c3cc485f302e3bc8e6837fefb1db02b923fb3b6e4ded850c18caeabe"
GEOID18_GRID_SOURCE_URL = "https://www.ngs.noaa.gov/PC_PROD/GEOID18/Format_unix/g2018u0.bin"


def default_geoid_grid_path() -> Path:
    """Repo-relative path to the vendored GEOID18 grid."""
    # scripts/geospatial/tsm_geodesy.py -> parents[2] is the repo root
    return Path(__file__).resolve().parents[2] / "data" / "geo" / "geoid18" / GEOID18_GRID_FILENAME

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


class GeoidGrid:
    """Reader for the NGS GEOID18 CONUS binary grid (Big-Endian unix format).

    Binary layout: 44-byte header then row-major big-endian float32 values
    starting at the SW corner, 1 arc-minute spacing.

    Header (big-endian):
        glamn f64 : latitude of SW corner (degrees)
        glomn f64 : longitude of SW corner (degrees, 0-360 East)
        dla   f64 : latitude spacing (degrees)
        dlo   f64 : longitude spacing (degrees)
        nla   i32 : number of latitude rows
        nlo   i32 : number of longitude columns
        ikind i32 : grid kind (1 = geoid)
    """

    HEADER_SIZE = 44

    def __init__(self, path: str | Path):
        self.path = Path(path)
        if not self.path.is_file():
            raise FileNotFoundError(
                f"GEOID18 grid file not found: {self.path}. "
                "Download the official Big-Endian CONUS grid (g2018u0.bin) from "
                "https://www.ngs.noaa.gov/GEOID/GEOID18/downloads.shtml "
                "(Format_unix). Refusing to substitute a constant."
            )
        with open(self.path, "rb") as f:
            hdr = f.read(self.HEADER_SIZE)
        if len(hdr) != self.HEADER_SIZE:
            raise ValueError(f"truncated GEOID18 header in {self.path}")
        self.glamn, self.glomn, self.dla, self.dlo = struct.unpack(">4d", hdr[:32])
        self.nla, self.nlo, self.ikind = struct.unpack(">3i", hdr[32:44])
        if self.nla <= 0 or self.nlo <= 0:
            raise ValueError(f"invalid GEOID18 grid dimensions in {self.path}")
        # Memory-map the values: row-major float32 from the SW corner.
        self._data = np.memmap(self.path, dtype=">f4", mode="r",
                               offset=self.HEADER_SIZE, shape=(self.nla, self.nlo))

    @property
    def lat_min(self) -> float:
        return self.glamn

    @property
    def lat_max(self) -> float:
        return self.glamn + (self.nla - 1) * self.dla

    def _lon_east(self, lon_deg: float) -> float:
        # Grid longitudes are 0-360 East; normalize input (-180..180 or 0..360).
        return lon_deg % 360.0

    def in_coverage(self, lat_deg: float, lon_deg: float) -> bool:
        lon_e = self._lon_east(lon_deg)
        lon_min, lon_max = self.glomn, self.glomn + (self.nlo - 1) * self.dlo
        return (self.lat_min <= lat_deg <= self.lat_max
                and lon_min <= lon_e <= lon_max)

    def sample(self, lat_deg: float, lon_deg: float) -> float:
        """Bilinear-interpolated geoid height N in meters.

        N = bilinear(N00, N10, N01, N11, dx, dy).
        Raises ValueError if the coordinate is outside grid coverage --
        never extrapolates.
        """
        if not self.in_coverage(lat_deg, lon_deg):
            raise ValueError(
                f"coordinate ({lat_deg}, {lon_deg}) is outside GEOID18 CONUS "
                f"coverage (lat {self.lat_min:.2f}..{self.lat_max:.2f}). "
                "Refusing to extrapolate."
            )
        lon_e = self._lon_east(lon_deg)
        fi = (lat_deg - self.glamn) / self.dla
        fj = (lon_e - self.glomn) / self.dlo
        i0, j0 = int(fi), int(fj)
        # Clamp upper index so i0+1/j0+1 stay in bounds at the grid edge.
        i0 = min(i0, self.nla - 2)
        j0 = min(j0, self.nlo - 2)
        di, dj = fi - i0, fj - j0
        n00 = float(self._data[i0, j0])
        n10 = float(self._data[i0 + 1, j0])
        n01 = float(self._data[i0, j0 + 1])
        n11 = float(self._data[i0 + 1, j0 + 1])
        return (n00 * (1 - di) * (1 - dj)
                + n10 * di * (1 - dj)
                + n01 * (1 - di) * dj
                + n11 * di * dj)


class GeoidModel:
    """GEOID18 geoid separation N lookup from the official NGS grid.

    h (ellipsoidal) = H (orthometric NAVD88) + N (geoid separation).

    Every N comes from bilinear interpolation of the real GEOID18 grid.
    There are no regional constants and no approximations. If the grid
    file is missing or a coordinate is outside coverage, this FAILS CLOSED.
    """

    def __init__(self, grid_path: str | Path | None = None):
        path = Path(grid_path) if grid_path else default_geoid_grid_path()
        self._grid = GeoidGrid(path)
        self.approximate = False
        self.note = f"NGS GEOID18 CONUS grid ({path.name}), bilinear interpolation"

    @classmethod
    def from_grid_file(cls, path: str | Path) -> "GeoidModel":
        """Load the real GEOID18 grid from an explicit path."""
        return cls(grid_path=path)

    def get_geoid_height(self, lat_deg: float, lon_deg: float) -> float:
        """Geoid separation N in meters at (lat, lon). Fail-closed."""
        return self._grid.sample(lat_deg, lon_deg)

    def separation_m(self, lon_deg: float, lat_deg: float) -> tuple[float, bool]:
        """Return (N_meters, is_approximate). is_approximate is always False:
        every value is sampled from the real grid."""
        return self._grid.sample(lat_deg, lon_deg), False


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
        "geoid_note": geoid.note,
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
        "geoid_note": geoid.note,
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
