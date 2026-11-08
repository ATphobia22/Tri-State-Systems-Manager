from __future__ import annotations

import math

import numpy as np

from .models import AdjustmentResult
from .quality import error_ellipse


def control_network_precision(
    result: AdjustmentResult,
    *,
    confidence: float = 0.95,
) -> list[dict[str, float | str]]:
    """Summarize coordinate precision and error ellipses for adjusted 2D points.

    The control-network solver stores unknown coordinates as ``x1, y1, x2, y2, ...``
    followed by any station-orientation parameters. This helper extracts each 2×2
    coordinate covariance block and reports one row per unknown point.

    ``sigma_x`` and ``sigma_y`` are posterior coordinate standard deviations in the
    coordinate unit. ``sigma_position`` is ``sqrt(sigma_x**2 + sigma_y**2)``. The
    ellipse axes and azimuth come from :func:`pysurveying.quality.error_ellipse`.

    Free-network covariance remains datum-realization dependent; this helper does
    not turn a minimum-norm free-network covariance into datum-independent precision.
    """
    if not 0 < confidence < 1:
        raise ValueError("confidence must be between 0 and 1")
    if result.covariance is None:
        raise ValueError("adjustment result does not contain covariance")

    metadata = result.metadata or {}
    point_order = list(metadata.get("point_order") or [])
    if not point_order:
        raise ValueError("result does not contain control-network point_order metadata")

    covariance = np.asarray(result.covariance, dtype=float)
    coordinate_parameter_count = int(
        metadata.get("coordinate_parameter_count", 2 * len(point_order))
    )
    required = 2 * len(point_order)
    if coordinate_parameter_count < required or covariance.shape[0] < required:
        raise ValueError("result covariance is incompatible with point_order")

    rows: list[dict[str, float | str]] = []
    for index, name in enumerate(point_order):
        start = 2 * index
        block = covariance[start : start + 2, start : start + 2]
        block = (block + block.T) / 2.0
        sigma_x = math.sqrt(max(float(block[0, 0]), 0.0))
        sigma_y = math.sqrt(max(float(block[1, 1]), 0.0))
        ellipse = error_ellipse(block, confidence=confidence)
        rows.append(
            {
                "name": str(name),
                "sigma_x": sigma_x,
                "sigma_y": sigma_y,
                "cov_xy": float(block[0, 1]),
                "sigma_position": math.hypot(sigma_x, sigma_y),
                "ellipse_semi_major": ellipse["semi_major"],
                "ellipse_semi_minor": ellipse["semi_minor"],
                "ellipse_azimuth": ellipse["azimuth"],
                "confidence": confidence,
            }
        )
    return rows
