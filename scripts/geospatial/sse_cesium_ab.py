#!/usr/bin/env python3
"""A/B geometric SSE: TSM formula vs Cesium-documented form.

Cesium SCENE3D: error = (geometricError * height) / (distance * sseDenominator)
"""

from __future__ import annotations

import math
import sys


def sse(e: float, h: float, d: float, denom: float, eps: float = 1e-7) -> float:
    return (e * h) / (max(d, eps) * denom)


def sse_denominator(fov_y: float) -> float:
    return 2.0 * math.tan(fov_y / 2.0)


def main() -> int:
    fov = math.radians(60)
    denom = sse_denominator(fov)
    h = 900.0
    e = 25.0
    near = sse(e, h, 100.0, denom)
    far = sse(e, h, 1000.0, denom)
    assert near > far
    d = 250.0
    a = sse(e, h, d, denom)
    b = (e * h) / (d * (2 * math.tan(fov / 2)))
    assert abs(a - b) < 1e-9
    print("sse_cesium_ab OK", {"near": near, "far": far, "denom": denom})
    print("NOTE: Live Cesium tileset A/B still required for production certification.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
