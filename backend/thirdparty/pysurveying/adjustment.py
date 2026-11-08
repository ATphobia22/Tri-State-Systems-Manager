from __future__ import annotations

import math
from collections.abc import Mapping, Sequence

import numpy as np

from .basic import azimuth, distance, normalize_angle
from .models import AdjustmentResult, Observation, Point


def _weight_matrix(weights: np.ndarray | Sequence[float] | None, n: int) -> np.ndarray:
    if weights is None:
        return np.eye(n)
    array = np.asarray(weights, dtype=float)
    if array.ndim == 1:
        if array.size != n:
            raise ValueError("weight vector length must equal number of observations")
        if np.any(array <= 0):
            raise ValueError("observation weights must be positive")
        return np.diag(array)
    if array.shape != (n, n):
        raise ValueError("P must be an n×n matrix or an n-element weight vector")
    if not np.allclose(array, array.T, atol=1e-12):
        raise ValueError("P must be symmetric")
    return array


def least_squares(
    A: np.ndarray,
    L: np.ndarray,
    P: np.ndarray | Sequence[float] | None = None,
) -> AdjustmentResult:
    """Weighted linear least squares for ``A x ≈ L``.

    ``P`` may be omitted, supplied as an observation-weight vector, or supplied as
    the full weight matrix. The result metadata contains ``Qxx``, ``Qvv`` and
    redundancy numbers so residual-based quality control can be performed without
    rebuilding the normal equations.
    """
    A = np.asarray(A, dtype=float)
    L = np.asarray(L, dtype=float).reshape(-1)
    if A.ndim != 2 or A.shape[0] != L.size:
        raise ValueError("A rows must equal the number of observations in L")
    if A.shape[1] == 0:
        raise ValueError("A must contain at least one unknown parameter")
    if not np.all(np.isfinite(A)) or not np.all(np.isfinite(L)):
        raise ValueError("A and L must contain finite values")

    W = _weight_matrix(P, L.size)
    normal = A.T @ W @ A
    rhs = A.T @ W @ L
    qxx = np.linalg.pinv(normal)
    x = qxx @ rhs
    v = A @ x - L

    rank = int(np.linalg.matrix_rank(A))
    dof = int(L.size - rank)
    sigma0 = float(math.sqrt((v @ W @ v) / dof)) if dof > 0 else None
    covariance = qxx if sigma0 is None else qxx * sigma0**2

    qll = np.linalg.pinv(W)
    qvv = qll - A @ qxx @ A.T
    qvv = (qvv + qvv.T) / 2.0
    redundancy = np.diag(qvv @ W)
    redundancy = np.clip(redundancy, 0.0, 1.0)

    return AdjustmentResult(
        parameters=x,
        residuals=v,
        sigma0=sigma0,
        covariance=covariance,
        dof=dof,
        metadata={
            "rank": rank,
            "normal_matrix": normal,
            "weight_matrix": W,
            "qxx": qxx,
            "qvv": qvv,
            "redundancy_numbers": redundancy,
        },
    )


def _unknown_names(points: Mapping[str, Point]) -> list[str]:
    return [name for name, point in points.items() if not point.fixed]


def _pack_coordinates(points: Mapping[str, Point], names: Sequence[str]) -> np.ndarray:
    return np.array([value for name in names for value in (points[name].x, points[name].y)])


def _point_xy(
    points: Mapping[str, Point], names: Sequence[str], values: np.ndarray, name: str
) -> tuple[float, float]:
    if name not in points:
        raise KeyError(f"unknown point: {name}")
    if points[name].fixed:
        return points[name].x, points[name].y
    index = names.index(name) * 2
    return float(values[index]), float(values[index + 1])


def _angle_difference(calculated: float, observed: float) -> float:
    return (calculated - observed + 180.0) % 360.0 - 180.0


def _huber_weights(residuals: np.ndarray, k: float) -> np.ndarray:
    absolute = np.abs(residuals)
    weights = np.ones_like(absolute)
    mask = absolute > k
    weights[mask] = k / absolute[mask]
    return weights


def _initial_orientations(
    point_map: Mapping[str, Point],
    coordinate_names: Sequence[str],
    coordinate_values: np.ndarray,
    observations: Sequence[Observation],
    stations: Sequence[str],
) -> np.ndarray:
    estimates: list[float] = []
    for station_name in stations:
        station_observations = [
            obs
            for obs in observations
            if obs.kind.lower() == "direction" and obs.from_point == station_name
        ]
        obs = station_observations[0]
        station = _point_xy(point_map, coordinate_names, coordinate_values, obs.from_point)
        target = _point_xy(point_map, coordinate_names, coordinate_values, obs.to_point)
        estimates.append(normalize_angle(azimuth(station, target) - obs.value))
    return np.asarray(estimates, dtype=float)


def adjust_control_network(
    points: Sequence[Point],
    observations: Sequence[Observation],
    *,
    max_iterations: int = 20,
    tolerance: float = 1e-7,
    free_network: bool = False,
    robust: bool = False,
    huber_k: float = 1.5,
) -> AdjustmentResult:
    """Adjust a small 2D control network.

    Supported observation kinds:

    - ``distance``: value and sigma use coordinate-distance units.
    - ``azimuth``: absolute surveying azimuth in degrees.
    - ``direction``: circle direction in degrees; one station-orientation unknown is
      introduced automatically for each station containing direction observations.
    - ``angle``: horizontal angle in degrees; ``from_point`` is the station,
      ``to_point`` the backsight and ``target2`` the foresight.

    All residuals are internally normalized by the observation standard deviation.
    The final linearized model also returns ``Qxx``, ``Qvv`` and observation
    redundancy numbers so control-network residuals can be screened consistently
    with the linear adjustment utilities.

    Set ``robust=True`` to apply Huber IRLS weights to the normalized residuals.
    For a free network, a minimum-norm pseudoinverse solution is used and the supplied
    approximate coordinates define the practical datum realization.
    """
    point_map = {p.name: Point(p.name, p.x, p.y, p.z, p.fixed) for p in points}
    coordinate_names = _unknown_names(point_map)
    if not coordinate_names:
        raise ValueError("network has no unknown points")
    if not observations:
        raise ValueError("network has no observations")
    if not free_network and not any(point.fixed for point in point_map.values()):
        raise ValueError("fixed control is required unless free_network=True")
    if any(obs.sigma <= 0 for obs in observations):
        raise ValueError("all observation sigmas must be positive")
    if huber_k <= 0:
        raise ValueError("huber_k must be positive")

    for obs in observations:
        if obs.from_point not in point_map or obs.to_point not in point_map:
            raise KeyError(f"observation references unknown point: {obs.from_point}->{obs.to_point}")
        if obs.target2 is not None and obs.target2 not in point_map:
            raise KeyError(f"observation references unknown target2: {obs.target2}")

    coordinate_values = _pack_coordinates(point_map, coordinate_names)
    orientation_stations = sorted(
        {obs.from_point for obs in observations if obs.kind.lower() == "direction"}
    )
    orientation_values = (
        _initial_orientations(
            point_map,
            coordinate_names,
            coordinate_values,
            observations,
            orientation_stations,
        )
        if orientation_stations
        else np.empty(0, dtype=float)
    )
    coordinate_parameter_count = coordinate_values.size
    values = np.concatenate((coordinate_values, orientation_values))
    n_parameters = values.size
    orientation_index = {
        name: coordinate_parameter_count + index
        for index, name in enumerate(orientation_stations)
    }

    def residual_vector(current: np.ndarray) -> np.ndarray:
        rows: list[float] = []
        for obs in observations:
            station = _point_xy(point_map, coordinate_names, current, obs.from_point)
            target = _point_xy(point_map, coordinate_names, current, obs.to_point)
            kind = obs.kind.lower()
            if kind == "distance":
                rows.append((distance(station, target) - obs.value) / obs.sigma)
            elif kind == "azimuth":
                rows.append(_angle_difference(azimuth(station, target), obs.value) / obs.sigma)
            elif kind == "direction":
                orientation = current[orientation_index[obs.from_point]]
                calculated = normalize_angle(azimuth(station, target) - orientation)
                rows.append(_angle_difference(calculated, obs.value) / obs.sigma)
            elif kind == "angle":
                if obs.target2 is None:
                    raise ValueError("angle observation requires target2")
                foresight = _point_xy(point_map, coordinate_names, current, obs.target2)
                calculated = (azimuth(station, foresight) - azimuth(station, target)) % 360.0
                rows.append(_angle_difference(calculated, obs.value) / obs.sigma)
            else:
                raise ValueError(f"unsupported observation kind: {obs.kind}")
        return np.asarray(rows, dtype=float)

    def numerical_jacobian(current: np.ndarray) -> np.ndarray:
        base = residual_vector(current)
        matrix = np.empty((base.size, n_parameters), dtype=float)
        for column in range(n_parameters):
            step = 1e-5 if column < coordinate_parameter_count else 1e-6
            plus = current.copy()
            minus = current.copy()
            plus[column] += step
            minus[column] -= step
            matrix[:, column] = (residual_vector(plus) - residual_vector(minus)) / (
                2.0 * step
            )
        return matrix

    converged = False
    final_weights = np.ones(len(observations), dtype=float)
    iteration = 0
    for iteration in range(1, max_iterations + 1):
        residuals = residual_vector(values)
        jacobian = numerical_jacobian(values)
        final_weights = (
            _huber_weights(residuals, huber_k) if robust else np.ones_like(residuals)
        )
        sqrt_w = np.sqrt(final_weights)
        weighted_jacobian = jacobian * sqrt_w[:, None]
        weighted_residuals = residuals * sqrt_w
        correction = -np.linalg.pinv(weighted_jacobian) @ weighted_residuals
        values = values + correction
        if orientation_stations:
            values[coordinate_parameter_count:] = np.mod(
                values[coordinate_parameter_count:], 360.0
            )
        if float(np.max(np.abs(correction))) < tolerance:
            converged = True
            break

    residuals = residual_vector(values)
    jacobian = numerical_jacobian(values)
    final_weights = (
        _huber_weights(residuals, huber_k) if robust else np.ones_like(residuals)
    )
    sqrt_w = np.sqrt(final_weights)
    weighted_jacobian = jacobian * sqrt_w[:, None]
    rank = int(np.linalg.matrix_rank(weighted_jacobian))
    dof = int(residuals.size - rank)
    weighted_ss = float(np.sum(final_weights * residuals**2))
    sigma0 = float(math.sqrt(weighted_ss / dof)) if dof > 0 else None

    weight_matrix = np.diag(final_weights)
    normal = jacobian.T @ weight_matrix @ jacobian
    qxx = np.linalg.pinv(normal)
    covariance = qxx if sigma0 is None else qxx * sigma0**2
    qll = np.linalg.pinv(weight_matrix)
    qvv = qll - jacobian @ qxx @ jacobian.T
    qvv = (qvv + qvv.T) / 2.0
    redundancy = np.diag(qvv @ weight_matrix)
    redundancy = np.clip(redundancy, 0.0, 1.0)

    sigmas = np.asarray([obs.sigma for obs in observations], dtype=float)
    raw_residuals = residuals * sigmas

    adjusted_points: dict[str, tuple[float, float]] = {}
    for point in point_map.values():
        if point.fixed:
            adjusted_points[point.name] = (point.x, point.y)
        else:
            adjusted_points[point.name] = _point_xy(
                point_map,
                coordinate_names,
                values,
                point.name,
            )

    adjusted_orientations = {
        name: normalize_angle(float(values[index]))
        for name, index in orientation_index.items()
    }

    return AdjustmentResult(
        parameters=values,
        residuals=residuals,
        sigma0=sigma0,
        covariance=covariance,
        dof=dof,
        converged=converged,
        iterations=iteration,
        metadata={
            "point_order": coordinate_names,
            "coordinate_parameter_count": coordinate_parameter_count,
            "orientation_order": orientation_stations,
            "orientations": adjusted_orientations,
            "adjusted_points": adjusted_points,
            "free_network": free_network,
            "robust": robust,
            "huber_k": huber_k,
            "robust_weights": final_weights,
            "rank": rank,
            "normal_matrix": normal,
            "weight_matrix": weight_matrix,
            "qxx": qxx,
            "qvv": qvv,
            "redundancy_numbers": redundancy,
            "raw_residuals": raw_residuals,
            "observation_sigmas": sigmas,
            "observation_kinds": [obs.kind.lower() for obs in observations],
            "residual_scale": "normalized_by_observation_sigma",
            "quality_note": (
                "Qvv and redundancy are from the final local linearization; "
                "robust results use final equivalent weights."
            ),
        },
    )


def adjust_control_network_robust(
    points: Sequence[Point],
    observations: Sequence[Observation],
    *,
    huber_k: float = 1.5,
    **kwargs,
) -> AdjustmentResult:
    """Convenience wrapper for Huber robust 2D control-network adjustment."""
    return adjust_control_network(
        points,
        observations,
        robust=True,
        huber_k=huber_k,
        **kwargs,
    )


def adjust_free_network(
    points: Sequence[Point], observations: Sequence[Observation], **kwargs
) -> AdjustmentResult:
    """Minimum-norm 2D free-network adjustment using supplied approximations."""
    free_points = [Point(point.name, point.x, point.y, point.z, False) for point in points]
    return adjust_control_network(free_points, observations, free_network=True, **kwargs)
