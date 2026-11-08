"""Weighted least-squares adjustment — thin wrappers over vendored pySurveying.

Two entry points:

* :func:`weighted_least_squares` — the linear model ``A x ≈ L`` with an
  optional weight vector or full weight matrix. Reproduces the
  textbook regression cases in the tests (Song Lijie §§3.1.5/3.2.5).
* :func:`adjust_control_network` — a small 2D control network from
  distance / azimuth / direction / angle observations with per-observation
  sigmas, returning adjusted points, residuals, sigma0, redundancy
  numbers, data-snooping flags and per-point error ellipses.

Every result records the input sigmas/weights it was computed from,
is stamped ``provisional: True``, and carries the advisory notice.
Residuals are reported in observation units (via
``control_network_quality``) as well as normalized, so a reviewer can
see the size of a misfit in feet or degrees — not only as a ratio.

Limits, stated plainly: 2D networks only (no 3D adjustment, no GNSS),
small networks (the vendored solver uses a numerical Jacobian), and
the QC routines are computational tools, not a substitute for the
significance-level design a surveying specification requires
(pySurveying's own caveat). Use GNU Gama (``scripts/survey/
gama_crosscheck.sh``) as an independent cross-check, never as a
replacement for a licensed surveyor.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

import numpy as np

from backend.survey import PROVISIONAL, SURVEY_ADVISORY_NOTICE
from backend.survey._pysurveying import PYSURVEYING_COMMIT, load_pysurveying

_SOURCE = f"pySurveying 0.3.0 (vendored, MIT) @ {PYSURVEYING_COMMIT[:7]}"


def _provenance() -> dict[str, Any]:
    return {
        "provisional": PROVISIONAL,
        "notice": SURVEY_ADVISORY_NOTICE,
        "source": _SOURCE,
    }


def weighted_least_squares(
    design: Sequence[Sequence[float]],
    observations: Sequence[float],
    weights: Sequence[float] | Sequence[Sequence[float]] | None = None,
) -> dict[str, Any]:
    """Weighted linear least squares for ``A x ≈ L``.

    ``weights`` may be omitted (unit weights), a per-observation weight
    vector, or a full symmetric weight matrix. Returns parameters,
    residuals, sigma0, degrees of freedom, Qxx/Qvv, redundancy numbers,
    standardized residuals and outlier flags (|w| >= 3).
    """
    ps = load_pysurveying()
    a = np.asarray(design, dtype=float)
    l = np.asarray(observations, dtype=float)
    result = ps.adjustment.least_squares(a, l, P=weights)
    std = ps.quality.standardized_residuals(result)
    redundancy = ps.quality.redundancy_numbers(result)
    outliers = ps.quality.detect_outliers(result, threshold=3.0)
    return {
        **_provenance(),
        "method": "weighted linear least squares",
        "parameters": [float(v) for v in result.parameters],
        "residuals": [float(v) for v in result.residuals],
        "sigma0": None if result.sigma0 is None else float(result.sigma0),
        "dof": int(result.dof),
        "converged": bool(result.converged),
        "qxx": np.asarray(result.metadata["qxx"], dtype=float).tolist(),
        "qvv": np.asarray(result.metadata["qvv"], dtype=float).tolist(),
        "redundancy_numbers": [float(v) for v in redundancy],
        "standardized_residuals": [float(v) for v in std],
        "outlier_indices_threshold_3": [int(i) for i in outliers],
        "weights_recorded": (
            None if weights is None else np.asarray(weights, dtype=float).tolist()
        ),
    }


def _as_point(raw: dict[str, Any]) -> Any:
    ps = load_pysurveying()
    return ps.models.Point(
        str(raw["name"]),
        float(raw["x"]),
        float(raw["y"]),
        None if raw.get("z") is None else float(raw["z"]),
        bool(raw.get("fixed", False)),
    )


def _as_observation(raw: dict[str, Any]) -> Any:
    ps = load_pysurveying()
    sigma = float(raw.get("sigma", 1.0))
    if sigma <= 0:
        raise ValueError(
            f"observation {raw.get('from_point')}->{raw.get('to_point')} "
            "must have a positive sigma"
        )
    return ps.models.Observation(
        kind=str(raw["kind"]).lower(),
        from_point=str(raw["from_point"]),
        to_point=str(raw["to_point"]),
        value=float(raw["value"]),
        sigma=sigma,
        target2=None if raw.get("target2") is None else str(raw["target2"]),
        metadata=dict(raw.get("metadata", {})),
    )


def adjust_control_network(
    points: Sequence[dict[str, Any]],
    observations: Sequence[dict[str, Any]],
    *,
    robust: bool = False,
    huber_k: float = 1.5,
    free_network: bool = False,
    crs: str = "EPSG:2966",
    units: str = "US ft",
    snooping_threshold: float = 3.0,
    confidence: float = 0.95,
) -> dict[str, Any]:
    """Adjust a small 2D control network by weighted least squares.

    ``points``: ``{name, x, y, fixed}`` — at least one point must be
    fixed unless ``free_network=True`` (minimum-norm datum; the
    approximate coordinates then define the datum realization).
    ``observations``: ``{kind, from_point, to_point, value, sigma,
    target2?}`` with kind in ``distance`` / ``azimuth`` / ``direction``
    / ``angle``. Distance sigmas are in coordinate units; angular
    sigmas are in degrees. Every sigma is recorded in the result.

    Returns adjusted points, orientations, residuals (normalized and in
    observation units), sigma0, dof, redundancy, the data-snooping
    table, and per-point precision with error ellipses.
    """
    ps = load_pysurveying()
    ps_points = [_as_point(p) for p in points]
    ps_observations = [_as_observation(o) for o in observations]
    result = ps.adjustment.adjust_control_network(
        ps_points,
        ps_observations,
        robust=robust,
        huber_k=huber_k,
        free_network=free_network,
    )
    quality = ps.quality.control_network_quality(
        result, ps_observations, threshold=snooping_threshold
    )
    precision = ps.precision.control_network_precision(
        result, confidence=confidence
    )
    adjusted = {
        name: (float(xy[0]), float(xy[1]))
        for name, xy in result.metadata["adjusted_points"].items()
    }
    return {
        **_provenance(),
        "method": (
            "Huber-robust 2D control-network adjustment"
            if robust
            else "weighted least-squares 2D control-network adjustment"
        ),
        "crs": crs,
        "units": units,
        "converged": bool(result.converged),
        "iterations": int(result.iterations),
        "adjusted_points": adjusted,
        "orientations_deg": {
            name: float(v)
            for name, v in result.metadata["orientations"].items()
        },
        "residuals_normalized": [float(v) for v in result.residuals],
        "sigma0": None if result.sigma0 is None else float(result.sigma0),
        "dof": int(result.dof),
        "observation_sigmas_recorded": [
            float(o["sigma"]) if "sigma" in o else 1.0 for o in observations
        ],
        "quality_table": quality,
        "flagged_observations": [
            row["index"] for row in quality if row["flagged"]
        ],
        "precision": precision,
        "free_network": bool(free_network),
        "robust": bool(robust),
    }
