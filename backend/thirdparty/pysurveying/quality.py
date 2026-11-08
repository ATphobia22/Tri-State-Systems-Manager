from __future__ import annotations

import math
from collections.abc import Sequence

import numpy as np
from scipy.optimize import least_squares as scipy_least_squares
from scipy.stats import chi2

from .adjustment import adjust_control_network, least_squares
from .models import AdjustmentResult, Observation, Point


def equivalent_weight_factor(
    value: float,
    *,
    method: str = "huber",
    k0: float = 1.5,
    k1: float = 2.5,
) -> float:
    """Return a classical surveying robust-equivalent weight factor.

    The supported piecewise functions are Huber, IGG1 and IGG3. ``value`` is
    expected to be a standardized residual. Huber needs only ``k0``; IGG1 and
    IGG3 also use the rejection threshold ``k1``.
    """
    if k0 <= 0:
        raise ValueError("k0 must be positive")
    name = method.strip().lower()
    if name not in {"huber", "igg1", "igg3"}:
        raise ValueError("method must be 'huber', 'igg1', or 'igg3'")
    if name != "huber" and k1 <= k0:
        raise ValueError("k1 must be greater than k0 for IGG methods")

    absolute = abs(float(value))
    if absolute <= k0:
        return 1.0
    if name == "huber":
        return k0 / absolute
    if absolute >= k1:
        return 0.0
    if name == "igg1":
        return k0 / absolute

    taper = (k1 - absolute) / (k1 - k0)
    return (k0 / absolute) * taper**2


def equivalent_weight_factors(
    values: Sequence[float] | np.ndarray,
    *,
    method: str = "huber",
    k0: float = 1.5,
    k1: float = 2.5,
) -> np.ndarray:
    """Vector form of :func:`equivalent_weight_factor`."""
    array = np.asarray(values, dtype=float)
    return np.asarray(
        [
            equivalent_weight_factor(value, method=method, k0=k0, k1=k1)
            for value in array.reshape(-1)
        ],
        dtype=float,
    ).reshape(array.shape)


def robust_least_squares(
    A: np.ndarray, L: np.ndarray, f_scale: float = 1.0
) -> AdjustmentResult:
    """Solve a linear model using SciPy's Huber robust loss.

    This compact convenience solver is retained for backwards compatibility. For
    surveying-style equivalent-weight iteration with Huber/IGG1/IGG3 functions,
    use :func:`robust_least_squares_irls`.

    The returned covariance is an approximate local covariance based on the final
    robust Jacobian. It should not be interpreted as classical least-squares
    covariance without qualification.
    """
    A = np.asarray(A, dtype=float)
    L = np.asarray(L, dtype=float).reshape(-1)
    if A.ndim != 2 or A.shape[0] != L.size:
        raise ValueError("A rows must equal len(L)")
    if f_scale <= 0:
        raise ValueError("f_scale must be positive")

    initial = np.linalg.lstsq(A, L, rcond=None)[0]
    solution = scipy_least_squares(
        lambda x: A @ x - L,
        initial,
        loss="huber",
        f_scale=f_scale,
    )
    residuals = A @ solution.x - L
    rank = int(np.linalg.matrix_rank(A))
    dof = int(L.size - rank)
    sigma0 = float(math.sqrt((residuals @ residuals) / dof)) if dof > 0 else None
    covariance = None
    if solution.jac.size:
        qxx = np.linalg.pinv(solution.jac.T @ solution.jac)
        covariance = qxx if sigma0 is None else qxx * sigma0**2

    return AdjustmentResult(
        solution.x,
        residuals,
        sigma0,
        covariance,
        dof,
        solution.success,
        int(solution.nfev),
        metadata={"method": "huber", "f_scale": f_scale, "covariance_note": "approximate"},
    )


def robust_least_squares_irls(
    A: np.ndarray,
    L: np.ndarray,
    *,
    method: str = "huber",
    k0: float = 1.5,
    k1: float = 2.5,
    max_iterations: int = 50,
    tolerance: float = 1e-10,
) -> AdjustmentResult:
    """Surveying-style robust linear adjustment by equivalent-weight IRLS."""
    A = np.asarray(A, dtype=float)
    L = np.asarray(L, dtype=float).reshape(-1)
    if A.ndim != 2 or A.shape[0] != L.size:
        raise ValueError("A rows must equal len(L)")
    if A.shape[1] == 0:
        raise ValueError("A must contain at least one unknown parameter")
    if max_iterations < 1:
        raise ValueError("max_iterations must be at least 1")
    if tolerance <= 0:
        raise ValueError("tolerance must be positive")

    initial = least_squares(A, L)
    if initial.sigma0 is None or initial.sigma0 <= 0:
        raise ValueError("robust adjustment requires positive redundancy and sigma0")

    qvv = np.asarray(initial.metadata["qvv"], dtype=float)
    residual_sd = initial.sigma0 * np.sqrt(np.maximum(np.diag(qvv), 0.0))
    valid_scale = residual_sd > np.finfo(float).eps
    if not np.any(valid_scale):
        raise ValueError("robust adjustment requires estimable residual variances")

    x = np.asarray(initial.parameters, dtype=float).copy()
    weights = np.ones(L.size, dtype=float)
    standardized = np.zeros(L.size, dtype=float)
    converged = False
    iteration = 0

    for iteration in range(1, max_iterations + 1):
        residuals = A @ x - L
        standardized.fill(0.0)
        standardized[valid_scale] = residuals[valid_scale] / residual_sd[valid_scale]
        weights = equivalent_weight_factors(
            standardized,
            method=method,
            k0=k0,
            k1=k1,
        )
        weights[~valid_scale] = 1.0

        active = weights > np.finfo(float).eps
        if np.count_nonzero(active) < A.shape[1]:
            raise ValueError("robust weighting rejected too many observations")

        sqrt_w = np.sqrt(weights)
        weighted_A = A * sqrt_w[:, None]
        weighted_L = L * sqrt_w
        x_new = np.linalg.lstsq(weighted_A, weighted_L, rcond=None)[0]
        if float(np.max(np.abs(x_new - x))) < tolerance:
            x = x_new
            converged = True
            break
        x = x_new

    residuals = A @ x - L
    standardized.fill(0.0)
    standardized[valid_scale] = residuals[valid_scale] / residual_sd[valid_scale]
    weights = equivalent_weight_factors(
        standardized,
        method=method,
        k0=k0,
        k1=k1,
    )
    weights[~valid_scale] = 1.0

    active = weights > np.finfo(float).eps
    rank = int(np.linalg.matrix_rank(A[active])) if np.any(active) else 0
    dof = int(np.count_nonzero(active) - rank)
    weighted_ss = float(np.sum(weights * residuals**2))
    sigma0 = float(math.sqrt(weighted_ss / dof)) if dof > 0 else None
    normal = A.T @ (weights[:, None] * A)
    qxx = np.linalg.pinv(normal)
    covariance = qxx if sigma0 is None else qxx * sigma0**2

    return AdjustmentResult(
        parameters=x,
        residuals=residuals,
        sigma0=sigma0,
        covariance=covariance,
        dof=dof,
        converged=converged,
        iterations=iteration,
        metadata={
            "method": method.lower(),
            "k0": k0,
            "k1": k1,
            "robust_weights": weights,
            "standardized_residuals": standardized.copy(),
            "initial_sigma0": initial.sigma0,
            "residual_sd": residual_sd,
            "qxx": qxx,
            "covariance_note": "approximate equivalent-weight covariance",
        },
    )


def standardized_residuals(result: AdjustmentResult) -> np.ndarray:
    """Return standardized residuals using ``Qvv`` when available."""
    residuals = np.asarray(result.residuals, dtype=float)
    if residuals.size == 0:
        return residuals

    qvv = result.metadata.get("qvv") if result.metadata else None
    if qvv is not None and result.sigma0 is not None and result.sigma0 > 0:
        qvv = np.asarray(qvv, dtype=float)
        if qvv.shape == (residuals.size, residuals.size):
            scale = result.sigma0 * np.sqrt(np.maximum(np.diag(qvv), 0.0))
            output = np.zeros_like(residuals)
            valid = scale > np.finfo(float).eps
            output[valid] = residuals[valid] / scale[valid]
            return output

    if result.sigma0 is not None and result.sigma0 > 0:
        return residuals / result.sigma0
    sample_sd = float(np.std(residuals, ddof=1)) if residuals.size > 1 else 0.0
    return residuals / sample_sd if sample_sd > 0 else np.zeros_like(residuals)


def redundancy_numbers(result: AdjustmentResult) -> np.ndarray:
    """Return observation redundancy numbers when available."""
    values = result.metadata.get("redundancy_numbers") if result.metadata else None
    if values is None:
        return np.full(np.asarray(result.residuals).size, np.nan)
    return np.asarray(values, dtype=float)


def detect_outliers(result: AdjustmentResult, threshold: float = 3.0) -> list[int]:
    """Return indices whose absolute standardized residual exceeds ``threshold``."""
    if threshold <= 0:
        raise ValueError("threshold must be positive")
    return np.flatnonzero(np.abs(standardized_residuals(result)) >= threshold).tolist()


def data_snooping(
    result: AdjustmentResult, threshold: float = 3.0
) -> list[dict[str, float | int | bool]]:
    """Return a compact residual-screening table."""
    if threshold <= 0:
        raise ValueError("threshold must be positive")
    residuals = np.asarray(result.residuals, dtype=float)
    standardized = standardized_residuals(result)
    redundancy = redundancy_numbers(result)
    rows: list[dict[str, float | int | bool]] = []
    for index, (v, w, r) in enumerate(zip(residuals, standardized, redundancy)):
        rows.append(
            {
                "index": index,
                "residual": float(v),
                "standardized_residual": float(w),
                "redundancy": float(r),
                "flagged": bool(abs(w) >= threshold),
            }
        )
    return rows


def iterative_data_snooping(
    A: np.ndarray,
    L: np.ndarray,
    P: np.ndarray | Sequence[float] | None = None,
    *,
    threshold: float = 3.0,
    max_removals: int | None = None,
) -> dict[str, object]:
    """Iteratively remove the largest standardized residual above a threshold."""
    A = np.asarray(A, dtype=float)
    L = np.asarray(L, dtype=float).reshape(-1)
    if A.ndim != 2 or A.shape[0] != L.size:
        raise ValueError("A rows must equal len(L)")
    if threshold <= 0:
        raise ValueError("threshold must be positive")
    if max_removals is not None and max_removals < 0:
        raise ValueError("max_removals must be non-negative")

    base_weights: np.ndarray | None = None
    base_covariance: np.ndarray | None = None
    if P is not None:
        array = np.asarray(P, dtype=float)
        if array.ndim == 1:
            if array.size != L.size or np.any(array <= 0):
                raise ValueError("weight vector must contain one positive value per observation")
            base_weights = array
        elif array.shape == (L.size, L.size):
            if not np.allclose(array, array.T, atol=1e-12):
                raise ValueError("P must be symmetric")
            base_covariance = np.linalg.pinv(array)
        else:
            raise ValueError("P must be an n-vector or n×n matrix")

    active = np.ones(L.size, dtype=bool)
    removed: list[int] = []
    history: list[dict[str, float | int | bool]] = []
    stopped_reason = "threshold_satisfied"
    final_result: AdjustmentResult | None = None

    while True:
        indices = np.flatnonzero(active)
        if base_weights is not None:
            current_P: np.ndarray | None = base_weights[indices]
        elif base_covariance is not None:
            covariance = base_covariance[np.ix_(indices, indices)]
            current_P = np.linalg.pinv(covariance)
        else:
            current_P = None

        final_result = least_squares(A[indices], L[indices], current_P)
        standardized = standardized_residuals(final_result)
        if standardized.size == 0:
            stopped_reason = "no_observations"
            break

        local_index = int(np.argmax(np.abs(standardized)))
        global_index = int(indices[local_index])
        score = float(standardized[local_index])
        flagged = bool(abs(score) >= threshold)
        history.append(
            {
                "iteration": len(history) + 1,
                "index": global_index,
                "residual": float(final_result.residuals[local_index]),
                "standardized_residual": score,
                "removed": flagged,
            }
        )

        if not flagged:
            stopped_reason = "threshold_satisfied"
            break
        if max_removals is not None and len(removed) >= max_removals:
            history[-1]["removed"] = False
            stopped_reason = "max_removals"
            break

        candidate_active = active.copy()
        candidate_active[global_index] = False
        candidate_indices = np.flatnonzero(candidate_active)
        candidate_rank = int(np.linalg.matrix_rank(A[candidate_indices]))
        if candidate_indices.size <= candidate_rank:
            history[-1]["removed"] = False
            stopped_reason = "insufficient_redundancy"
            break

        active = candidate_active
        removed.append(global_index)

    return {
        "result": final_result,
        "removed_indices": removed,
        "active_indices": np.flatnonzero(active).tolist(),
        "history": history,
        "converged": stopped_reason == "threshold_satisfied",
        "stopped_reason": stopped_reason,
        "threshold": threshold,
    }


def control_network_quality(
    result: AdjustmentResult,
    observations: Sequence[Observation],
    *,
    threshold: float = 3.0,
) -> list[dict[str, object]]:
    """Return observation-by-observation quality diagnostics for a control network.

    Residuals from :func:`adjust_control_network` are normalized by each observation
    sigma. This table adds the residual in the observation's original unit, the
    standardized residual based on the final local ``Qvv``, the redundancy number,
    and the final robust weight when applicable.
    """
    if threshold <= 0:
        raise ValueError("threshold must be positive")
    if len(observations) != len(result.residuals):
        raise ValueError("observations must match the adjustment result")

    normalized = np.asarray(result.residuals, dtype=float)
    raw = result.metadata.get("raw_residuals") if result.metadata else None
    if raw is None:
        raw = np.asarray(
            [value * obs.sigma for value, obs in zip(normalized, observations)],
            dtype=float,
        )
    else:
        raw = np.asarray(raw, dtype=float)
    standardized = standardized_residuals(result)
    redundancy = redundancy_numbers(result)
    weights = result.metadata.get("robust_weights") if result.metadata else None
    if weights is None:
        weights = np.ones(normalized.size, dtype=float)
    else:
        weights = np.asarray(weights, dtype=float)

    rows: list[dict[str, object]] = []
    for index, obs in enumerate(observations):
        kind = obs.kind.lower()
        rows.append(
            {
                "index": index,
                "kind": kind,
                "from_point": obs.from_point,
                "to_point": obs.to_point,
                "target2": obs.target2,
                "observed_value": float(obs.value),
                "sigma": float(obs.sigma),
                "residual_observation_unit": float(raw[index]),
                "residual_unit": "deg" if kind in {"azimuth", "direction", "angle"} else "coordinate",
                "normalized_residual": float(normalized[index]),
                "standardized_residual": float(standardized[index]),
                "redundancy": float(redundancy[index]),
                "robust_weight": float(weights[index]),
                "flagged": bool(abs(standardized[index]) >= threshold),
            }
        )
    return rows


def control_network_data_snooping(
    points: Sequence[Point],
    observations: Sequence[Observation],
    *,
    threshold: float = 3.0,
    max_removals: int | None = None,
    **adjustment_kwargs,
) -> dict[str, object]:
    """Iteratively locate and remove gross observations in a 2D control network.

    Every cycle performs a fresh ordinary network adjustment, computes standardized
    residuals from the final local ``Qvv``, removes the observation with the largest
    absolute standardized residual when it exceeds ``threshold``, and re-adjusts.
    The original observation indices are preserved in the returned history.
    """
    if threshold <= 0:
        raise ValueError("threshold must be positive")
    if max_removals is not None and max_removals < 0:
        raise ValueError("max_removals must be non-negative")
    if adjustment_kwargs.get("robust"):
        raise ValueError("control-network data snooping uses ordinary adjustment")

    original = list(observations)
    if not original:
        raise ValueError("network has no observations")
    active = list(range(len(original)))
    removed: list[int] = []
    history: list[dict[str, object]] = []
    final_result: AdjustmentResult | None = None
    stopped_reason = "threshold_satisfied"

    while True:
        current_observations = [original[index] for index in active]
        final_result = adjust_control_network(
            points,
            current_observations,
            robust=False,
            **adjustment_kwargs,
        )
        if final_result.sigma0 is None or final_result.dof <= 0:
            stopped_reason = "insufficient_redundancy"
            break

        rows = control_network_quality(
            final_result,
            current_observations,
            threshold=threshold,
        )
        local_index = int(
            np.argmax([abs(float(row["standardized_residual"])) for row in rows])
        )
        global_index = active[local_index]
        row = rows[local_index]
        flagged = bool(row["flagged"])
        history.append(
            {
                "iteration": len(history) + 1,
                "index": global_index,
                "kind": row["kind"],
                "from_point": row["from_point"],
                "to_point": row["to_point"],
                "target2": row["target2"],
                "residual_observation_unit": row["residual_observation_unit"],
                "standardized_residual": row["standardized_residual"],
                "redundancy": row["redundancy"],
                "removed": flagged,
            }
        )

        if not flagged:
            stopped_reason = "threshold_satisfied"
            break
        if max_removals is not None and len(removed) >= max_removals:
            history[-1]["removed"] = False
            stopped_reason = "max_removals"
            break

        candidate_active = active.copy()
        candidate_active.pop(local_index)
        if not candidate_active:
            history[-1]["removed"] = False
            stopped_reason = "insufficient_redundancy"
            break

        try:
            candidate_result = adjust_control_network(
                points,
                [original[index] for index in candidate_active],
                robust=False,
                **adjustment_kwargs,
            )
        except (ValueError, KeyError, np.linalg.LinAlgError):
            history[-1]["removed"] = False
            stopped_reason = "insufficient_geometry"
            break

        if candidate_result.dof <= 0:
            history[-1]["removed"] = False
            stopped_reason = "insufficient_redundancy"
            break

        active = candidate_active
        removed.append(global_index)

    final_quality: list[dict[str, object]] = []
    if final_result is not None:
        current_observations = [original[index] for index in active]
        for local_index, row in enumerate(
            control_network_quality(
                final_result,
                current_observations,
                threshold=threshold,
            )
        ):
            final_quality.append({"original_index": active[local_index], **row})

    return {
        "result": final_result,
        "removed_indices": removed,
        "active_indices": active,
        "history": history,
        "quality": final_quality,
        "converged": stopped_reason == "threshold_satisfied",
        "stopped_reason": stopped_reason,
        "threshold": threshold,
    }


def error_ellipse(
    covariance_2x2: np.ndarray, confidence: float = 0.95
) -> dict[str, float]:
    """Return axes and undirected surveying azimuth of a 2D error ellipse.

    Because an ellipse axis has no arrow direction, the reported major-axis azimuth
    is normalized to the surveying interval ``[0, 180)`` degrees.
    """
    covariance = np.asarray(covariance_2x2, dtype=float)
    if covariance.shape != (2, 2):
        raise ValueError("covariance_2x2 must be 2×2")
    if not np.allclose(covariance, covariance.T, atol=1e-12):
        raise ValueError("covariance_2x2 must be symmetric")
    if not 0 < confidence < 1:
        raise ValueError("confidence must be between 0 and 1")

    eigenvalues, eigenvectors = np.linalg.eigh(covariance)
    order = np.argsort(eigenvalues)[::-1]
    eigenvalues = np.maximum(eigenvalues[order], 0.0)
    eigenvectors = eigenvectors[:, order]
    scale = math.sqrt(float(chi2.ppf(confidence, df=2)))
    semi_major = float(scale * math.sqrt(eigenvalues[0]))
    semi_minor = float(scale * math.sqrt(eigenvalues[1]))
    vx, vy = eigenvectors[:, 0]
    theta = float(math.degrees(math.atan2(vx, vy)) % 180.0)
    return {
        "semi_major": semi_major,
        "semi_minor": semi_minor,
        "azimuth": theta,
        "confidence": confidence,
    }
