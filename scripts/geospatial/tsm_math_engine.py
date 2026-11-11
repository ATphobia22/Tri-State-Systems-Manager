#!/usr/bin/env python3
"""TSM geospatial math primitives.

Coordinates are not datum transformations: all geodetic/ECEF helpers below use
the WGS84 ellipsoid and require WGS84 ellipsoidal heights in meters. GEOID18
requires a separately verified NAD83(2011) epoch-2010.00 height and a measured
NGS geoid undulation. Do not use NAD83 heights as WGS84 without transformation.
"""
import math
from typing import Any, Dict, List, Tuple

import numpy as np

WGS84_A = 6378137.0
WGS84_FINV = 298.257223563
WGS84_F = 1.0 / WGS84_FINV
WGS84_B = WGS84_A * (1.0 - WGS84_F)
WGS84_E2 = WGS84_F * (2.0 - WGS84_F)


def _finite(*values: float) -> None:
    if not all(math.isfinite(float(v)) for v in values):
        raise ValueError("Non-finite geospatial or hydraulic value")


class TSMMathEngine:
    @staticmethod
    def geodetic_to_ecef(lat_deg: float, lon_deg: float, height_m: float) -> Tuple[float, float, float]:
        """EPSG:4979 -> EPSG:4978, WGS84 ellipsoidal height in meters."""
        _finite(lat_deg, lon_deg, height_m)
        if not -90 <= lat_deg <= 90 or not -180 <= lon_deg <= 180:
            raise ValueError("Latitude or longitude outside valid range")
        phi, lam = math.radians(lat_deg), math.radians(lon_deg)
        sin_phi, cos_phi = math.sin(phi), math.cos(phi)
        n = WGS84_A / math.sqrt(1.0 - WGS84_E2 * sin_phi**2)
        return ((n + height_m) * cos_phi * math.cos(lam),
                (n + height_m) * cos_phi * math.sin(lam),
                (n * (1.0 - WGS84_E2) + height_m) * sin_phi)

    @staticmethod
    def ecef_to_geodetic(x: float, y: float, z: float) -> Tuple[float, float, float]:
        """Stable iterative inverse of WGS84 ECEF for terrestrial coordinates."""
        _finite(x, y, z)
        p = math.hypot(x, y)
        if p == 0.0:
            if z == 0.0:
                raise ValueError("ECEF origin has no unique geodetic position")
            return (90.0 if z > 0 else -90.0, 0.0, abs(z) - WGS84_B)
        lon = math.atan2(y, x)
        phi = math.atan2(z, p * (1.0 - WGS84_E2))
        h = 0.0
        for _ in range(20):
            sin_phi = math.sin(phi)
            n = WGS84_A / math.sqrt(1.0 - WGS84_E2 * sin_phi**2)
            next_h = (p / math.cos(phi) - n) if abs(math.cos(phi)) > 1e-9 else (z / sin_phi - n * (1.0 - WGS84_E2))
            next_phi = math.atan2(z + WGS84_E2 * n * sin_phi, p)
            if abs(next_phi - phi) < 1e-14 and abs(next_h - h) < 1e-7:
                phi, h = next_phi, next_h
                break
            phi, h = next_phi, next_h
        else:
            raise ArithmeticError("ECEF inversion did not converge")
        return (math.degrees(phi), math.degrees(lon), h)

    @staticmethod
    def transform_ellipsoidal_to_orthometric(
        ellipsoidal_h: float, geoid_undulation_n: float, model_id: str,
        source_url: str, source_frame: str = "NAD83(2011)",
        reference_epoch: str = "2010.00",
    ) -> Dict[str, Any]:
        """H_NAVD88 = h_NAD83(2011) - N_GEOID18; N must be independently measured."""
        _finite(ellipsoidal_h, geoid_undulation_n)
        if model_id != "GEOID18" or source_frame != "NAD83(2011)" or reference_epoch != "2010.00":
            raise ValueError("GEOID18 requires NAD83(2011), epoch 2010.00 and model GEOID18")
        if not source_url.startswith("https://"):
            raise ValueError("A source HTTPS URL is required for geoid provenance")
        return {
            "ellipsoidal_height_m": ellipsoidal_h,
            "geoid_undulation_n_m": geoid_undulation_n,
            "orthometric_height_navd88_m": ellipsoidal_h - geoid_undulation_n,
            "vertical_datum": "NAVD88",
            "model_provenance": {"model_id": model_id, "source_url": source_url,
                                 "source_frame": source_frame, "reference_epoch": reference_epoch},
        }

    @staticmethod
    def compute_enu_to_ecef_rotation_matrix(lat_deg: float, lon_deg: float) -> np.ndarray:
        _finite(lat_deg, lon_deg)
        if not -90 <= lat_deg <= 90 or not -180 <= lon_deg <= 180:
            raise ValueError("Invalid latitude or longitude")
        phi, lam = math.radians(lat_deg), math.radians(lon_deg)
        sp, cp, sl, cl = math.sin(phi), math.cos(phi), math.sin(lam), math.cos(lam)
        return np.array([[-sl, -sp*cl, cp*cl],
                         [ cl, -sp*sl, cp*sl],
                         [0.0, cp, sp]], dtype=np.float64)

    @staticmethod
    def build_ogc_tileset_transform_matrix(lat_deg: float, lon_deg: float, height_m: float) -> List[float]:
        """Column-major ENU-local meters to WGS84 ECEF meters, per OGC 3D Tiles 1.1."""
        x, y, z = TSMMathEngine.geodetic_to_ecef(lat_deg, lon_deg, height_m)
        mat = np.eye(4, dtype=np.float64)
        mat[:3, :3] = TSMMathEngine.compute_enu_to_ecef_rotation_matrix(lat_deg, lon_deg)
        mat[:3, 3] = [x, y, z]
        return mat.flatten(order="F").tolist()

    @staticmethod
    def verify_rotation_orthonormality(matrix_4x4: List[float]) -> bool:
        if len(matrix_4x4) != 16:
            return False
        values = np.asarray(matrix_4x4, dtype=np.float64)
        if not np.all(np.isfinite(values)):
            return False
        m = values.reshape((4, 4), order="F")
        r = m[:3, :3]
        return bool(np.allclose(r.T @ r, np.eye(3), rtol=0, atol=1e-10)
                    and np.isclose(np.linalg.det(r), 1.0, rtol=0, atol=1e-10)
                    and np.allclose(m[3, :], [0, 0, 0, 1], rtol=0, atol=1e-10))

    @staticmethod
    def compute_oriented_bounding_box(ecef_points: np.ndarray) -> Dict[str, Any]:
        """Enclosing PCA OBB in ECEF meters; OGC box contains 3 center + 9 half-axis values.

        PCA minimizes variance along the axes; it does NOT guarantee minimum-volume OBB.
        The output is a global-ECEF bounding volume, not a local tile-coordinate box.
        """
        pts = np.asarray(ecef_points, dtype=np.float64)
        if pts.ndim != 2 or pts.shape[1] != 3 or len(pts) == 0 or not np.all(np.isfinite(pts)):
            raise ValueError("Expected nonempty finite Nx3 ECEF points")
        origin = pts.mean(axis=0)
        centered = pts - origin
        if len(pts) == 1:
            axes = np.eye(3)
        else:
            _, _, vt = np.linalg.svd(centered, full_matrices=False)
            axes = vt.T if vt.shape == (3, 3) else np.eye(3)
        if np.linalg.det(axes) < 0:
            axes[:, 2] *= -1
        projected = centered @ axes
        minimum = projected.min(axis=0)
        maximum = projected.max(axis=0)
        half_extents = (maximum - minimum) / 2.0
        center = origin + axes @ ((maximum + minimum) / 2.0)
        half_axes = axes * half_extents[np.newaxis, :]
        box = center.tolist() + half_axes[:, 0].tolist() + half_axes[:, 1].tolist() + half_axes[:, 2].tolist()
        return {"center": center.tolist(), "half_extents": half_extents.tolist(),
                "ogc_3d_tiles_box": box}

    @staticmethod
    def compute_manning_open_channel_velocity(hydraulic_radius_r: float, bed_slope_s: float, mannings_n: float) -> float:
        """SI units only; steady empirical velocity, NOT a 2D shallow-water solver."""
        _finite(hydraulic_radius_r, bed_slope_s, mannings_n)
        if mannings_n <= 0 or hydraulic_radius_r < 0 or bed_slope_s < 0:
            raise ValueError("Require n>0, R>=0 and S>=0")
        return (hydraulic_radius_r**(2.0/3.0)) * math.sqrt(bed_slope_s) / mannings_n
