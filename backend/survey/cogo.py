"""Coordinate geometry (COGO) — thin wrappers over vendored pySurveying.

No new surveying mathematics lives here. Each function validates its
inputs, calls the matching vendored function, and returns the result
with provenance attached (``provisional: True``, source library and
commit, input frame/units). All angles are surveying azimuths in
degrees, clockwise from north (+Y), exactly as pySurveying defines
them. All coordinates are planar (x = easting, y = northing).

TSM convention: inputs are EPSG:2966 (Indiana State Plane West,
US ft) unless the caller passes ``crs``/``units`` explicitly. The
wrappers record whatever the caller declares — they do not reproject
and do not guess a frame.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from backend.survey import PROVISIONAL, SURVEY_ADVISORY_NOTICE
from backend.survey._pysurveying import PYSURVEYING_COMMIT, load_pysurveying

Point2D = tuple[float, float]

_SOURCE = f"pySurveying 0.3.0 (vendored, MIT) @ {PYSURVEYING_COMMIT[:7]}"


def _provenance(crs: str = "EPSG:2966", units: str = "US ft") -> dict[str, Any]:
    return {
        "provisional": PROVISIONAL,
        "notice": SURVEY_ADVISORY_NOTICE,
        "source": _SOURCE,
        "crs": crs,
        "units": units,
    }


def _point(value: Sequence[float] | Point2D, name: str) -> Point2D:
    if len(value) < 2:
        raise ValueError(f"{name} must contain x and y")
    x, y = float(value[0]), float(value[1])
    if x != x or y != y:  # NaN guard — never let a NaN become a coordinate
        raise ValueError(f"{name} contains a non-finite coordinate")
    return (x, y)


def inverse(
    from_point: Sequence[float],
    to_point: Sequence[float],
    *,
    crs: str = "EPSG:2966",
    units: str = "US ft",
) -> dict[str, Any]:
    """Inverse: distance and surveying azimuth between two known points."""
    ps = load_pysurveying()
    p1, p2 = _point(from_point, "from_point"), _point(to_point, "to_point")
    result = ps.basic.inverse_coordinate(p1, p2)
    return {
        **_provenance(crs, units),
        "from_point": p1,
        "to_point": p2,
        "distance": float(result["distance"]),
        "azimuth_deg": float(result["azimuth"]),
    }


def forward(
    point: Sequence[float],
    azimuth_deg: float,
    distance: float,
    *,
    crs: str = "EPSG:2966",
    units: str = "US ft",
) -> dict[str, Any]:
    """Forward: point at ``distance`` along ``azimuth_deg`` from ``point``."""
    ps = load_pysurveying()
    origin = _point(point, "point")
    if distance < 0:
        raise ValueError("distance must be non-negative")
    x, y = ps.basic.forward_coordinate(
        origin[0], origin[1], float(azimuth_deg), float(distance)
    )
    return {
        **_provenance(crs, units),
        "from_point": origin,
        "azimuth_deg": float(azimuth_deg),
        "distance": float(distance),
        "point": (float(x), float(y)),
    }


def azimuth_between(
    from_point: Sequence[float], to_point: Sequence[float]
) -> float:
    """Surveying azimuth (deg, clockwise from north) between two points."""
    ps = load_pysurveying()
    return float(
        ps.basic.azimuth(
            _point(from_point, "from_point"), _point(to_point, "to_point")
        )
    )


def distance_between(
    from_point: Sequence[float], to_point: Sequence[float]
) -> float:
    """Planar distance between two points, in the caller's units."""
    ps = load_pysurveying()
    return float(
        ps.basic.distance(
            _point(from_point, "from_point"), _point(to_point, "to_point")
        )
    )


def _traverse_result(
    raw: dict[str, Any], *, crs: str, units: str, method: str
) -> dict[str, Any]:
    coordinates = [(float(x), float(y)) for x, y in raw["coordinates"]]
    out: dict[str, Any] = {
        **_provenance(crs, units),
        "method": method,
        "coordinates": coordinates,
        "misclosure_x": float(raw["misclosure_x"]),
        "misclosure_y": float(raw["misclosure_y"]),
        "linear_misclosure": float(raw["linear_misclosure"]),
        "total_length": float(raw["total_length"]),
        "relative_precision": (
            float(raw["relative_precision"])
            if raw["relative_precision"] != float("inf")
            else None
        ),
    }
    # Optional keys only present on the from-angles variant.
    if "azimuths" in raw:
        out["azimuths"] = [float(a) for a in raw["azimuths"]]
    if "direction_misclosure" in raw:
        out["direction_misclosure_deg"] = float(raw["direction_misclosure"])
    if "angle_adjustment" in raw:
        angle_adj = raw["angle_adjustment"]
        out["angle_adjustment"] = {
            "observed_sum": float(angle_adj["observed_sum"]),
            "theoretical_sum": float(angle_adj["theoretical_sum"]),
            "misclosure_deg": float(angle_adj["misclosure"]),
            "corrections_deg": [
                float(c) for c in angle_adj["corrections"]
            ],
            "adjusted_angles_deg": [
                float(a) for a in angle_adj["adjusted_angles"]
            ],
        }
    return out


def closed_traverse(
    start: Sequence[float],
    azimuths_deg: Sequence[float],
    distances: Sequence[float],
    *,
    crs: str = "EPSG:2966",
    units: str = "US ft",
) -> dict[str, Any]:
    """Bowditch adjustment of a geometrically closed traverse.

    ``azimuths_deg``/``distances`` are one entry per leg; the adjusted
    final coordinate returns to ``start``. Misclosure and relative
    precision are reported, not hidden.
    """
    ps = load_pysurveying()
    raw = ps.traverse.closed_traverse(
        _point(start, "start"),
        [float(a) for a in azimuths_deg],
        [float(d) for d in distances],
    )
    return _traverse_result(
        raw, crs=crs, units=units, method="Bowditch (closed traverse)"
    )


def connected_traverse(
    start: Sequence[float],
    end: Sequence[float],
    azimuths_deg: Sequence[float],
    distances: Sequence[float],
    *,
    crs: str = "EPSG:2966",
    units: str = "US ft",
) -> dict[str, Any]:
    """Bowditch adjustment of a traverse connecting two known points."""
    ps = load_pysurveying()
    raw = ps.traverse.connected_traverse(
        _point(start, "start"),
        _point(end, "end"),
        [float(a) for a in azimuths_deg],
        [float(d) for d in distances],
    )
    return _traverse_result(
        raw, crs=crs, units=units, method="Bowditch (connected traverse)"
    )


def closed_traverse_from_angles(
    start: Sequence[float],
    start_azimuth_deg: float,
    interior_angles_deg: Sequence[float],
    distances: Sequence[float],
    *,
    turn: str = "right",
    crs: str = "EPSG:2966",
    units: str = "US ft",
) -> dict[str, Any]:
    """Closed traverse from interior angles: angle adjustment, then Bowditch.

    One interior angle per side, ordered at the end of each leg. The
    final adjusted angle is a closure check, not an extra side.
    """
    ps = load_pysurveying()
    raw = ps.traverse.closed_traverse_from_angles(
        _point(start, "start"),
        float(start_azimuth_deg),
        [float(a) for a in interior_angles_deg],
        [float(d) for d in distances],
        turn=turn,
    )
    return _traverse_result(
        raw,
        crs=crs,
        units=units,
        method="angle adjustment + Bowditch (closed traverse)",
    )


def adjust_angles(
    angles_deg: Sequence[float],
    *,
    theoretical_sum: float | None = None,
    weights: Sequence[float] | None = None,
) -> dict[str, Any]:
    """Distribute an angular misclosure by weighted least squares."""
    ps = load_pysurveying()
    raw = ps.traverse.adjust_angles(
        [float(a) for a in angles_deg],
        theoretical_sum=theoretical_sum,
        weights=None if weights is None else [float(w) for w in weights],
    )
    return {
        **_provenance(),
        "method": "weighted least-squares angle adjustment",
        "observed_sum_deg": float(raw["observed_sum"]),
        "theoretical_sum_deg": float(raw["theoretical_sum"]),
        "misclosure_deg": float(raw["misclosure"]),
        "corrections_deg": [float(c) for c in raw["corrections"]],
        "adjusted_angles_deg": [float(a) for a in raw["adjusted_angles"]],
    }


def forward_intersection(
    point1: Sequence[float],
    azimuth1_deg: float,
    point2: Sequence[float],
    azimuth2_deg: float,
    *,
    crs: str = "EPSG:2966",
    units: str = "US ft",
) -> dict[str, Any]:
    """Intersect two rays, each given by a known point and an azimuth."""
    ps = load_pysurveying()
    x, y = ps.basic.forward_intersection(
        _point(point1, "point1"),
        float(azimuth1_deg),
        _point(point2, "point2"),
        float(azimuth2_deg),
    )
    return {
        **_provenance(crs, units),
        "point": (float(x), float(y)),
        "from_rays": [
            {"point": _point(point1, "point1"), "azimuth_deg": float(azimuth1_deg)},
            {"point": _point(point2, "point2"), "azimuth_deg": float(azimuth2_deg)},
        ],
    }


def distance_intersection(
    point1: Sequence[float],
    radius1: float,
    point2: Sequence[float],
    radius2: float,
    *,
    crs: str = "EPSG:2966",
    units: str = "US ft",
) -> dict[str, Any]:
    """Circle–circle intersection; returns both solutions (or one tangent)."""
    ps = load_pysurveying()
    first, second = ps.basic.distance_intersection(
        _point(point1, "point1"),
        float(radius1),
        _point(point2, "point2"),
        float(radius2),
    )
    solutions = [(float(first[0]), float(first[1]))]
    if second is not None:
        solutions.append((float(second[0]), float(second[1])))
    return {
        **_provenance(crs, units),
        "solutions": solutions,
        "solution_count": len(solutions),
    }


def resection(
    known_points: Sequence[Sequence[float]],
    directions_deg: Sequence[float],
    *,
    initial: Sequence[float] | None = None,
    crs: str = "EPSG:2966",
    units: str = "US ft",
) -> dict[str, Any]:
    """2D orientation resection from >=3 known points + observed directions.

    Returns the station position and the orientation constant in degrees.
    """
    ps = load_pysurveying()
    points = [_point(p, f"known_points[{i}]") for i, p in enumerate(known_points)]
    x, y, orientation = ps.basic.resection(
        points,
        [float(d) for d in directions_deg],
        initial=None if initial is None else [float(v) for v in initial],
    )
    return {
        **_provenance(crs, units),
        "station": (float(x), float(y)),
        "orientation_deg": float(orientation),
        "known_points": points,
        "directions_deg": [float(d) for d in directions_deg],
    }


def polar_stakeout(
    station: Sequence[float],
    target: Sequence[float],
    *,
    crs: str = "EPSG:2966",
    units: str = "US ft",
) -> dict[str, Any]:
    """Stakeout azimuth and horizontal distance from station to target."""
    ps = load_pysurveying()
    result = ps.engineering.polar_stakeout(
        _point(station, "station"), _point(target, "target")
    )
    return {
        **_provenance(crs, units),
        "station": _point(station, "station"),
        "target": _point(target, "target"),
        "azimuth_deg": float(result["azimuth"]),
        "distance": float(result["distance"]),
    }
