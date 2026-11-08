from __future__ import annotations

import math
from collections.abc import Sequence

import numpy as np

from .basic import normalize_angle


def _coordinate_increments(
    azimuths: Sequence[float], distances: Sequence[float]
) -> tuple[np.ndarray, np.ndarray]:
    angles = np.radians(np.asarray(azimuths, dtype=float))
    lengths = np.asarray(distances, dtype=float)
    if angles.size != lengths.size:
        raise ValueError("azimuths and distances must have the same length")
    if np.any(lengths <= 0):
        raise ValueError("distances must be positive")
    return lengths * np.sin(angles), lengths * np.cos(angles)


def _bowditch(
    start: Sequence[float],
    target_end: Sequence[float],
    azimuths_deg: Sequence[float],
    distances: Sequence[float],
) -> dict[str, object]:
    x0, y0 = map(float, start[:2])
    xe, ye = map(float, target_end[:2])
    dx, dy = _coordinate_increments(azimuths_deg, distances)
    fx = x0 + float(dx.sum()) - xe
    fy = y0 + float(dy.sum()) - ye
    lengths = np.asarray(distances, dtype=float)
    total = float(lengths.sum())
    cdx = -fx * lengths / total
    cdy = -fy * lengths / total
    adx, ady = dx + cdx, dy + cdy

    coordinates = [(x0, y0)]
    x, y = x0, y0
    for ddx, ddy in zip(adx, ady):
        x += float(ddx)
        y += float(ddy)
        coordinates.append((x, y))

    linear = math.hypot(fx, fy)
    return {
        "coordinates": coordinates,
        "raw_dx": dx,
        "raw_dy": dy,
        "corrections_x": cdx,
        "corrections_y": cdy,
        "misclosure_x": fx,
        "misclosure_y": fy,
        "linear_misclosure": linear,
        "total_length": total,
        "relative_precision": math.inf if linear == 0 else total / linear,
    }


def closed_traverse(
    start: Sequence[float],
    azimuths_deg: Sequence[float],
    distances: Sequence[float],
) -> dict[str, object]:
    """Bowditch adjustment of a geometrically closed traverse."""
    return _bowditch(start, start, azimuths_deg, distances)


def connected_traverse(
    start: Sequence[float],
    end: Sequence[float],
    azimuths_deg: Sequence[float],
    distances: Sequence[float],
) -> dict[str, object]:
    """Bowditch adjustment of a traverse connecting two known points."""
    return _bowditch(start, end, azimuths_deg, distances)


def adjust_angles(
    angles_deg: Sequence[float],
    *,
    theoretical_sum: float | None = None,
    weights: Sequence[float] | None = None,
) -> dict[str, object]:
    """Distribute an angular misclosure by weighted least squares.

    When ``theoretical_sum`` is omitted, the angles are treated as the interior
    angles of a closed polygon and ``(n - 2) * 180°`` is used.
    """
    angles = np.asarray(angles_deg, dtype=float)
    if angles.size < 3:
        raise ValueError("at least three angles are required")
    target = float((angles.size - 2) * 180.0 if theoretical_sum is None else theoretical_sum)
    misclosure = float(angles.sum() - target)

    if weights is None:
        inverse_weights = np.ones(angles.size, dtype=float)
    else:
        weight_array = np.asarray(weights, dtype=float)
        if weight_array.size != angles.size or np.any(weight_array <= 0):
            raise ValueError("weights must be positive and match angles")
        inverse_weights = 1.0 / weight_array

    corrections = -misclosure * inverse_weights / inverse_weights.sum()
    adjusted = angles + corrections
    return {
        "observed_sum": float(angles.sum()),
        "theoretical_sum": target,
        "misclosure": misclosure,
        "corrections": corrections,
        "adjusted_angles": adjusted,
    }


def traverse_azimuths_from_angles(
    start_azimuth_deg: float,
    interior_angles_deg: Sequence[float],
    turn: str = "right",
) -> list[float]:
    """Propagate traverse azimuths from interior angles."""
    azimuths = [normalize_angle(start_azimuth_deg)]
    for angle in interior_angles_deg:
        if turn == "right":
            azimuths.append(normalize_angle(azimuths[-1] + 180.0 - angle))
        elif turn == "left":
            azimuths.append(normalize_angle(azimuths[-1] - 180.0 + angle))
        else:
            raise ValueError("turn must be 'right' or 'left'")
    return azimuths


def closed_traverse_from_angles(
    start: Sequence[float],
    start_azimuth_deg: float,
    interior_angles_deg: Sequence[float],
    distances: Sequence[float],
    *,
    turn: str = "right",
    angle_weights: Sequence[float] | None = None,
) -> dict[str, object]:
    """Adjust closed-polygon angles, derive side azimuths, then apply Bowditch.

    Angles are ordered at the end of each corresponding leg. The final adjusted
    angle closes the direction loop and is therefore used as a closure check rather
    than to create an additional side.
    """
    lengths = list(distances)
    angles = list(interior_angles_deg)
    if len(lengths) != len(angles):
        raise ValueError("a closed traverse requires one interior angle per side")
    angle_result = adjust_angles(angles, weights=angle_weights)
    adjusted_angles = angle_result["adjusted_angles"]
    azimuths = traverse_azimuths_from_angles(
        start_azimuth_deg,
        adjusted_angles[:-1],
        turn=turn,
    )
    result = closed_traverse(start, azimuths, lengths)
    closure_azimuth = traverse_azimuths_from_angles(
        azimuths[-1],
        [adjusted_angles[-1]],
        turn=turn,
    )[-1]
    direction_misclosure = (closure_azimuth - normalize_angle(start_azimuth_deg) + 180.0) % 360.0 - 180.0
    result.update(
        {
            "angle_adjustment": angle_result,
            "azimuths": azimuths,
            "direction_closure": closure_azimuth,
            "direction_misclosure": direction_misclosure,
        }
    )
    return result
