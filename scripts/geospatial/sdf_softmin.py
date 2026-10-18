#!/usr/bin/env python3
"""Soft-min blend of heightfield SDF and volumetric SDF.

f_blend = -1/k * log(exp(-k*f_h) + exp(-k*f_v))
"""

from __future__ import annotations

import math
from typing import Union

import numpy as np

ArrayLike = Union[float, np.ndarray]


def softmin_blend(f_h: ArrayLike, f_v: ArrayLike, k: float = 8.0) -> ArrayLike:
    if k <= 0 or not math.isfinite(k):
        raise ValueError("k must be finite and > 0")
    fh = np.asarray(f_h, dtype=np.float64)
    fv = np.asarray(f_v, dtype=np.float64)
    a = -k * fh
    b = -k * fv
    m = np.maximum(a, b)
    lse = m + np.log(np.exp(a - m) + np.exp(b - m))
    return (-1.0 / k) * lse


def heightfield_sdf(z: ArrayLike, h_xy: ArrayLike) -> ArrayLike:
    return np.asarray(z, dtype=np.float64) - np.asarray(h_xy, dtype=np.float64)


if __name__ == "__main__":
    h = 10.0
    zs = np.linspace(0, 20, 5)
    fh = heightfield_sdf(zs, h)
    fv = zs - 12.0
    print(softmin_blend(fh, fv, k=8.0))
