from __future__ import annotations

import math
from collections.abc import Sequence

from .basic import azimuth, distance, forward_coordinate


def polar_stakeout(
    station: Sequence[float], target: Sequence[float]
) -> dict[str, float]:
    """Return stakeout azimuth and horizontal distance from station to target."""
    return {"azimuth": azimuth(station, target), "distance": distance(station, target)}


def offset_point(
    start: Sequence[float],
    end: Sequence[float],
    chainage: float,
    offset: float = 0.0,
) -> tuple[float, float]:
    """Point at chainage along a straight baseline with signed right-hand offset."""
    line_azimuth = azimuth(start, end)
    x, y = forward_coordinate(float(start[0]), float(start[1]), line_azimuth, chainage)
    if offset == 0:
        return x, y
    side_azimuth = line_azimuth + (90.0 if offset >= 0 else -90.0)
    return forward_coordinate(x, y, side_azimuth, abs(offset))


def chainage_offset(
    point: Sequence[float],
    start: Sequence[float],
    end: Sequence[float],
) -> dict[str, float]:
    """Project a point onto a straight baseline and return chainage and signed offset.

    Positive offset is to the right when looking from ``start`` to ``end``.
    """
    x, y = float(point[0]), float(point[1])
    x1, y1 = float(start[0]), float(start[1])
    x2, y2 = float(end[0]), float(end[1])
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy)
    if length == 0:
        raise ValueError("baseline start and end must be distinct")

    ux, uy = dx / length, dy / length
    px, py = x - x1, y - y1
    chainage = px * ux + py * uy
    right_x, right_y = uy, -ux
    offset = px * right_x + py * right_y
    foot = (x1 + chainage * ux, y1 + chainage * uy)
    return {
        "chainage": chainage,
        "offset": offset,
        "foot_x": foot[0],
        "foot_y": foot[1],
    }


def slope(horizontal_distance: float, height_difference: float, percent: bool = True) -> float:
    """Compute longitudinal slope as ratio or percent."""
    if horizontal_distance == 0:
        raise ValueError("horizontal_distance cannot be zero")
    value = height_difference / horizontal_distance
    return value * 100.0 if percent else value


def grade_elevation(
    start_height: float,
    horizontal_distance: float,
    grade: float,
    *,
    percent: bool = True,
) -> float:
    """Compute design elevation at a distance along a constant grade."""
    ratio = grade / 100.0 if percent else grade
    return float(start_height + horizontal_distance * ratio)


def height_difference_from_slope_distance(
    slope_distance: float,
    vertical_angle_deg: float,
    *,
    angle_from_horizontal: bool = True,
) -> float:
    """Convert slope distance and vertical angle to height difference."""
    if slope_distance < 0:
        raise ValueError("slope_distance cannot be negative")
    angle = math.radians(vertical_angle_deg)
    if angle_from_horizontal:
        return float(slope_distance * math.sin(angle))
    return float(slope_distance * math.cos(angle))


def horizontal_distance_from_slope(
    slope_distance: float,
    vertical_angle_deg: float,
    *,
    angle_from_horizontal: bool = True,
) -> float:
    """Convert slope distance and vertical angle to horizontal distance."""
    if slope_distance < 0:
        raise ValueError("slope_distance cannot be negative")
    angle = math.radians(vertical_angle_deg)
    if angle_from_horizontal:
        return float(slope_distance * math.cos(angle))
    return float(slope_distance * math.sin(angle))


def polygon_area(points: Sequence[Sequence[float]]) -> float:
    """Planar polygon area by the shoelace formula."""
    if len(points) < 3:
        raise ValueError("at least three points are required")
    area = 0.0
    for index, point in enumerate(points):
        next_point = points[(index + 1) % len(points)]
        area += (
            float(point[0]) * float(next_point[1])
            - float(next_point[0]) * float(point[1])
        )
    return abs(area) / 2.0
