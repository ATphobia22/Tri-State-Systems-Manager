from __future__ import annotations

import math
from collections.abc import Mapping, Sequence

import numpy as np
from pyproj import CRS, Transformer


def transform_coordinates(
    x: float | Sequence[float],
    y: float | Sequence[float],
    from_crs: str | int,
    to_crs: str | int,
    *,
    always_xy: bool = True,
):
    """Transform one coordinate or coordinate arrays between two CRS definitions."""
    transformer = Transformer.from_crs(
        CRS.from_user_input(from_crs),
        CRS.from_user_input(to_crs),
        always_xy=always_xy,
    )
    return transformer.transform(x, y)


def geodetic_to_ecef(lon: float, lat: float, height: float = 0.0) -> tuple[float, float, float]:
    """Convert WGS84 longitude, latitude and ellipsoidal height to ECEF XYZ."""
    transformer = Transformer.from_crs("EPSG:4979", "EPSG:4978", always_xy=True)
    x, y, z = transformer.transform(lon, lat, height)
    return float(x), float(y), float(z)


def ecef_to_geodetic(x: float, y: float, z: float) -> tuple[float, float, float]:
    """Convert WGS84 ECEF XYZ to longitude, latitude and ellipsoidal height."""
    transformer = Transformer.from_crs("EPSG:4978", "EPSG:4979", always_xy=True)
    lon, lat, height = transformer.transform(x, y, z)
    return float(lon), float(lat), float(height)


def _ecef_to_enu_rotation(lon0: float, lat0: float) -> np.ndarray:
    lon = math.radians(lon0)
    lat = math.radians(lat0)
    return np.array(
        [
            [-math.sin(lon), math.cos(lon), 0.0],
            [
                -math.sin(lat) * math.cos(lon),
                -math.sin(lat) * math.sin(lon),
                math.cos(lat),
            ],
            [
                math.cos(lat) * math.cos(lon),
                math.cos(lat) * math.sin(lon),
                math.sin(lat),
            ],
        ],
        dtype=float,
    )


def ecef_to_enu(
    x: float,
    y: float,
    z: float,
    lon0: float,
    lat0: float,
    height0: float = 0.0,
) -> tuple[float, float, float]:
    """Convert ECEF XYZ to local east, north, up coordinates."""
    origin = np.asarray(geodetic_to_ecef(lon0, lat0, height0), dtype=float)
    delta = np.asarray([x, y, z], dtype=float) - origin
    east, north, up = _ecef_to_enu_rotation(lon0, lat0) @ delta
    return float(east), float(north), float(up)


def enu_to_ecef(
    east: float,
    north: float,
    up: float,
    lon0: float,
    lat0: float,
    height0: float = 0.0,
) -> tuple[float, float, float]:
    """Convert local east, north, up coordinates to WGS84 ECEF XYZ."""
    origin = np.asarray(geodetic_to_ecef(lon0, lat0, height0), dtype=float)
    local = np.asarray([east, north, up], dtype=float)
    xyz = origin + _ecef_to_enu_rotation(lon0, lat0).T @ local
    return float(xyz[0]), float(xyz[1]), float(xyz[2])


def geodetic_to_enu(
    lon: float,
    lat: float,
    height: float,
    lon0: float,
    lat0: float,
    height0: float = 0.0,
) -> tuple[float, float, float]:
    """Convert WGS84 geodetic coordinates directly to a local ENU frame."""
    return ecef_to_enu(*geodetic_to_ecef(lon, lat, height), lon0, lat0, height0)


def enu_to_geodetic(
    east: float,
    north: float,
    up: float,
    lon0: float,
    lat0: float,
    height0: float = 0.0,
) -> tuple[float, float, float]:
    """Convert local ENU coordinates directly to WGS84 geodetic coordinates."""
    return ecef_to_geodetic(*enu_to_ecef(east, north, up, lon0, lat0, height0))


def _xy_array(points: Sequence[Sequence[float]], minimum: int) -> np.ndarray:
    array = np.asarray(points, dtype=float)
    if array.ndim != 2 or array.shape[1] != 2 or array.shape[0] < minimum:
        raise ValueError(f"points must have shape (n, 2) with n >= {minimum}")
    if not np.all(np.isfinite(array)):
        raise ValueError("points must contain finite values")
    return array


def _point_weights(weights: Sequence[float] | None, n: int) -> np.ndarray:
    if weights is None:
        return np.ones(n, dtype=float)
    values = np.asarray(weights, dtype=float)
    if values.size != n or np.any(values <= 0):
        raise ValueError("weights must be positive and match the number of points")
    return values


def fit_similarity_2d(
    source: Sequence[Sequence[float]],
    target: Sequence[Sequence[float]],
    *,
    weights: Sequence[float] | None = None,
) -> dict[str, object]:
    """Fit a four-parameter 2D similarity transformation.

    The model is ``X = tx + a*x - b*y`` and ``Y = ty + b*x + a*y``.
    Returned rotation is counter-clockwise in the mathematical XY plane.
    """
    src = _xy_array(source, 2)
    dst = _xy_array(target, 2)
    if src.shape != dst.shape:
        raise ValueError("source and target must have the same shape")
    point_weights = _point_weights(weights, len(src))

    A = np.zeros((2 * len(src), 4), dtype=float)
    L = dst.reshape(-1)
    for i, (x, y) in enumerate(src):
        A[2 * i] = [1.0, 0.0, x, -y]
        A[2 * i + 1] = [0.0, 1.0, y, x]

    sqrt_w = np.repeat(np.sqrt(point_weights), 2)
    parameters, *_ = np.linalg.lstsq(A * sqrt_w[:, None], L * sqrt_w, rcond=None)
    tx, ty, a, b = parameters
    transformed = apply_similarity_2d(src, parameters)
    residuals = transformed - dst
    rmse = float(np.sqrt(np.mean(np.sum(residuals**2, axis=1))))
    return {
        "parameters": parameters,
        "tx": float(tx),
        "ty": float(ty),
        "a": float(a),
        "b": float(b),
        "scale": float(math.hypot(a, b)),
        "rotation_deg": float(math.degrees(math.atan2(b, a))),
        "residuals": residuals,
        "rmse": rmse,
    }


def apply_similarity_2d(
    points: Sequence[Sequence[float]],
    parameters: Sequence[float] | Mapping[str, float],
) -> np.ndarray:
    """Apply a four-parameter similarity transformation to XY points."""
    pts = _xy_array(points, 1)
    if isinstance(parameters, Mapping):
        tx = float(parameters["tx"])
        ty = float(parameters["ty"])
        a = float(parameters["a"])
        b = float(parameters["b"])
    else:
        values = np.asarray(parameters, dtype=float).reshape(-1)
        if values.size != 4:
            raise ValueError("similarity parameters must contain tx, ty, a, b")
        tx, ty, a, b = values
    x = pts[:, 0]
    y = pts[:, 1]
    return np.column_stack((tx + a * x - b * y, ty + b * x + a * y))


def fit_affine_2d(
    source: Sequence[Sequence[float]],
    target: Sequence[Sequence[float]],
    *,
    weights: Sequence[float] | None = None,
) -> dict[str, object]:
    """Fit a six-parameter 2D affine transformation."""
    src = _xy_array(source, 3)
    dst = _xy_array(target, 3)
    if src.shape != dst.shape:
        raise ValueError("source and target must have the same shape")
    point_weights = _point_weights(weights, len(src))

    A = np.zeros((2 * len(src), 6), dtype=float)
    L = dst.reshape(-1)
    for i, (x, y) in enumerate(src):
        A[2 * i] = [1.0, x, y, 0.0, 0.0, 0.0]
        A[2 * i + 1] = [0.0, 0.0, 0.0, 1.0, x, y]

    sqrt_w = np.repeat(np.sqrt(point_weights), 2)
    parameters, *_ = np.linalg.lstsq(A * sqrt_w[:, None], L * sqrt_w, rcond=None)
    transformed = apply_affine_2d(src, parameters)
    residuals = transformed - dst
    rmse = float(np.sqrt(np.mean(np.sum(residuals**2, axis=1))))
    return {"parameters": parameters, "residuals": residuals, "rmse": rmse}


def apply_affine_2d(
    points: Sequence[Sequence[float]], parameters: Sequence[float]
) -> np.ndarray:
    """Apply six affine parameters ``tx, a, b, ty, c, d`` to XY points."""
    pts = _xy_array(points, 1)
    values = np.asarray(parameters, dtype=float).reshape(-1)
    if values.size != 6:
        raise ValueError("affine parameters must contain tx, a, b, ty, c, d")
    tx, a, b, ty, c, d = values
    x = pts[:, 0]
    y = pts[:, 1]
    return np.column_stack((tx + a * x + b * y, ty + c * x + d * y))
