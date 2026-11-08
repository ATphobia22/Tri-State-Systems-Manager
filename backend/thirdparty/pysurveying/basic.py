from __future__ import annotations

import math
from collections.abc import Sequence

import numpy as np
from scipy.optimize import least_squares

from .models import Point


def normalize_angle(angle: float) -> float:
    """Normalize an angle in degrees to [0, 360)."""
    return float(angle % 360.0)


def dms_to_degree(degrees: float, minutes: float = 0.0, seconds: float = 0.0) -> float:
    """Convert degree-minute-second values to decimal degrees."""
    sign = -1.0 if degrees < 0 else 1.0
    return sign * (abs(degrees) + minutes / 60.0 + seconds / 3600.0)


def degree_to_dms(angle: float) -> tuple[int, int, float]:
    """Convert decimal degrees to a ``(degrees, minutes, seconds)`` tuple."""
    sign = -1 if angle < 0 else 1
    value = abs(float(angle))
    d = int(value)
    m_float = (value - d) * 60.0
    m = int(m_float)
    s = (m_float - m) * 60.0
    return sign * d, m, s


def _xy(point: Point | Sequence[float]) -> tuple[float, float]:
    if isinstance(point, Point):
        return float(point.x), float(point.y)
    if len(point) < 2:
        raise ValueError("point must contain x and y")
    return float(point[0]), float(point[1])


def distance(p1: Point | Sequence[float], p2: Point | Sequence[float]) -> float:
    x1, y1 = _xy(p1)
    x2, y2 = _xy(p2)
    return math.hypot(x2 - x1, y2 - y1)


def azimuth(p1: Point | Sequence[float], p2: Point | Sequence[float]) -> float:
    """Return surveying azimuth in degrees, clockwise from north (+Y)."""
    x1, y1 = _xy(p1)
    x2, y2 = _xy(p2)
    return normalize_angle(math.degrees(math.atan2(x2 - x1, y2 - y1)))


def forward_coordinate(
    x: float, y: float, azimuth_deg: float, length: float
) -> tuple[float, float]:
    """Coordinate forward computation using surveying azimuth."""
    rad = math.radians(azimuth_deg)
    return x + length * math.sin(rad), y + length * math.cos(rad)


def inverse_coordinate(
    p1: Point | Sequence[float], p2: Point | Sequence[float]
) -> dict[str, float]:
    return {"distance": distance(p1, p2), "azimuth": azimuth(p1, p2)}


def forward_intersection(
    p1: Point | Sequence[float],
    azimuth1: float,
    p2: Point | Sequence[float],
    azimuth2: float,
) -> tuple[float, float]:
    """Intersect two rays defined by a point and surveying azimuth."""
    x1, y1 = _xy(p1)
    x2, y2 = _xy(p2)
    a1 = math.radians(azimuth1)
    a2 = math.radians(azimuth2)
    d1 = np.array([math.sin(a1), math.cos(a1)])
    d2 = np.array([math.sin(a2), math.cos(a2)])
    matrix = np.column_stack((d1, -d2))
    if abs(np.linalg.det(matrix)) < 1e-12:
        raise ValueError("intersection rays are parallel or nearly parallel")
    t = np.linalg.solve(matrix, np.array([x2 - x1, y2 - y1]))[0]
    point = np.array([x1, y1]) + t * d1
    return float(point[0]), float(point[1])


def distance_intersection(
    p1: Point | Sequence[float],
    r1: float,
    p2: Point | Sequence[float],
    r2: float,
) -> tuple[tuple[float, float], tuple[float, float] | None]:
    """Circle-circle intersection from two known points and measured distances."""
    x1, y1 = _xy(p1)
    x2, y2 = _xy(p2)
    d = math.hypot(x2 - x1, y2 - y1)
    if d == 0:
        raise ValueError("known points must be distinct")
    if d > r1 + r2 or d < abs(r1 - r2):
        raise ValueError("circles do not intersect")
    a = (r1 * r1 - r2 * r2 + d * d) / (2.0 * d)
    h2 = max(r1 * r1 - a * a, 0.0)
    h = math.sqrt(h2)
    xm = x1 + a * (x2 - x1) / d
    ym = y1 + a * (y2 - y1) / d
    rx = -(y2 - y1) * h / d
    ry = (x2 - x1) * h / d
    q1 = (xm + rx, ym + ry)
    if h < 1e-12:
        return q1, None
    return q1, (xm - rx, ym - ry)


def resection(
    known_points: Sequence[Point | Sequence[float]],
    directions_deg: Sequence[float],
    initial: Sequence[float] | None = None,
) -> tuple[float, float, float]:
    """2D orientation resection from known points and observed directions.

    Returns station X, station Y and orientation constant in degrees.
    """
    if len(known_points) != len(directions_deg) or len(known_points) < 3:
        raise ValueError("resection requires at least three point-direction pairs")
    xy = np.array([_xy(point) for point in known_points], dtype=float)
    obs = np.asarray(directions_deg, dtype=float)
    if initial is None:
        x0 = float(xy[:, 0].mean())
        y0 = float(xy[:, 1].mean())
        ori0 = normalize_angle(azimuth((x0, y0), xy[0]) - obs[0])
        initial = (x0, y0, ori0)

    def residuals(params: np.ndarray) -> np.ndarray:
        x, y, orientation = params
        calc = np.array([azimuth((x, y), point) for point in xy])
        return (calc - (obs + orientation) + 180.0) % 360.0 - 180.0

    solution = least_squares(residuals, np.asarray(initial, dtype=float), method="trf")
    if not solution.success:
        raise RuntimeError(solution.message)
    return (
        float(solution.x[0]),
        float(solution.x[1]),
        normalize_angle(float(solution.x[2])),
    )
