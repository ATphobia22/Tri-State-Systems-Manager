from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np


@dataclass(slots=True)
class Point:
    """A surveying point using the package X/Y coordinate convention."""

    name: str
    x: float
    y: float
    z: float | None = None
    fixed: bool = False

    def xy(self) -> np.ndarray:
        return np.array([self.x, self.y], dtype=float)


@dataclass(slots=True)
class Observation:
    """A compact observation record for small 2D control networks.

    Supported kinds are ``distance``, ``direction``/``azimuth`` and ``angle``.
    For an angle, ``from_point`` is the station, ``to_point`` is the backsight,
    and ``target2`` is the foresight.
    """

    kind: str
    from_point: str
    to_point: str
    value: float
    sigma: float = 1.0
    target2: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class LevelObservation:
    """Observed height difference ``H_to - H_from`` with standard deviation."""

    from_point: str
    to_point: str
    height_difference: float
    sigma: float = 1.0
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class AdjustmentResult:
    parameters: np.ndarray
    residuals: np.ndarray
    sigma0: float | None
    covariance: np.ndarray | None
    dof: int
    converged: bool = True
    iterations: int = 1
    metadata: dict[str, Any] = field(default_factory=dict)
