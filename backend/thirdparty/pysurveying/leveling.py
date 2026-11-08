from __future__ import annotations

from collections.abc import Mapping, Sequence

import numpy as np

from .adjustment import least_squares
from .models import AdjustmentResult, LevelObservation


def leveling_route(
    start_height: float,
    height_differences: Sequence[float],
    *,
    end_height: float | None = None,
    lengths: Sequence[float] | None = None,
) -> dict[str, object]:
    """Adjust a closed or connected leveling route by proportional correction.

    If ``lengths`` is omitted, equal correction per section is used. If ``end_height``
    is omitted, the route is treated as closing back to ``start_height``.
    """
    dh = np.asarray(height_differences, dtype=float)
    if dh.size == 0:
        raise ValueError("height_differences cannot be empty")
    if lengths is None:
        basis = np.ones(dh.size)
    else:
        basis = np.asarray(lengths, dtype=float)
        if basis.size != dh.size or np.any(basis <= 0):
            raise ValueError("lengths must be positive and match height_differences")

    target = float(start_height if end_height is None else end_height)
    raw_end = float(start_height + dh.sum())
    misclosure = raw_end - target
    corrections = -misclosure * basis / basis.sum()
    adjusted = dh + corrections

    heights = [float(start_height)]
    for value in adjusted:
        heights.append(heights[-1] + float(value))

    return {
        "misclosure": misclosure,
        "corrections": corrections,
        "adjusted_height_differences": adjusted,
        "heights": heights,
        "raw_end_height": raw_end,
        "target_end_height": target,
    }


def leveling_network(
    observations: Sequence[LevelObservation],
    fixed_heights: Mapping[str, float],
) -> AdjustmentResult:
    """Least-squares adjustment of a small leveling network.

    Each observation models ``H_to - H_from = dh`` and is weighted by
    ``1 / sigma**2``. At least one fixed benchmark is required.
    """
    if not observations:
        raise ValueError("observations cannot be empty")
    if not fixed_heights:
        raise ValueError("at least one fixed benchmark is required")
    if any(obs.sigma <= 0 for obs in observations):
        raise ValueError("all leveling observation sigmas must be positive")

    names = sorted(
        {
            name
            for obs in observations
            for name in (obs.from_point, obs.to_point)
            if name not in fixed_heights
        }
    )
    if not names:
        raise ValueError("network contains no unknown heights")
    index = {name: i for i, name in enumerate(names)}

    A = np.zeros((len(observations), len(names)), dtype=float)
    L = np.zeros(len(observations), dtype=float)
    weights = np.zeros(len(observations), dtype=float)

    for row, obs in enumerate(observations):
        rhs = float(obs.height_difference)
        if obs.to_point in index:
            A[row, index[obs.to_point]] += 1.0
        elif obs.to_point in fixed_heights:
            rhs -= float(fixed_heights[obs.to_point])
        else:
            raise KeyError(f"unknown point: {obs.to_point}")

        if obs.from_point in index:
            A[row, index[obs.from_point]] -= 1.0
        elif obs.from_point in fixed_heights:
            rhs += float(fixed_heights[obs.from_point])
        else:
            raise KeyError(f"unknown point: {obs.from_point}")

        L[row] = rhs
        weights[row] = 1.0 / float(obs.sigma) ** 2

    result = least_squares(A, L, weights)
    adjusted_heights = {name: float(height) for name, height in fixed_heights.items()}
    adjusted_heights.update({name: float(result.parameters[index[name]]) for name in names})
    result.metadata.update(
        {
            "point_order": names,
            "adjusted_heights": adjusted_heights,
            "observation_order": [
                (obs.from_point, obs.to_point) for obs in observations
            ],
        }
    )
    return result
