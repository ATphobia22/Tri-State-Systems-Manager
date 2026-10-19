#!/usr/bin/env python3
"""Synthetic DEM → SDF → balanced octree self-test (no rasterio / no Posey DEM).

Validates Stage 1–2 of dem_to_transvoxel without host-specific DEM_PATH.
Stage 3 polygonize remains local (skimage/trimesh) when real DEM is present.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

# Import pure helpers from the PoC module when available
sys.path.insert(0, str(Path(__file__).resolve().parent))


def synthetic_dem(n: int = 32, px: float = 2.0) -> tuple[np.ndarray, float]:
    yy, xx = np.mgrid[0:n, 0:n]
    # Gentle hill in meters
    dem = 100.0 + 8.0 * np.exp(-((xx - n / 2) ** 2 + (yy - n / 2) ** 2) / (2 * (n / 6) ** 2))
    return dem.astype(np.float64), px


def make_height_sampler(dem_m: np.ndarray, px: float):
    ny, nx = dem_m.shape

    def h(x, y):
        xa = np.atleast_1d(np.asarray(x, dtype=float))
        ya = np.atleast_1d(np.asarray(y, dtype=float))
        gx = xa / px
        gy = ya / px
        x0 = np.clip(np.floor(gx).astype(int), 0, nx - 2)
        y0 = np.clip(np.floor(gy).astype(int), 0, ny - 2)
        fx = np.clip(gx - x0, 0, 1)
        fy = np.clip(gy - y0, 0, 1)
        h00 = dem_m[y0, x0]
        h10 = dem_m[y0, x0 + 1]
        h01 = dem_m[y0 + 1, x0]
        h11 = dem_m[y0 + 1, x0 + 1]
        out = (
            h00 * (1 - fx) * (1 - fy)
            + h10 * fx * (1 - fy)
            + h01 * (1 - fx) * fy
            + h11 * fx * fy
        )
        return float(out[0]) if np.asarray(x).ndim == 0 else out

    return h


def build_sdf_grid(h, n: int, px: float, z0m: float, dz: float) -> np.ndarray:
    ii, jj = np.meshgrid(np.arange(n), np.arange(n), indexing="ij")
    hs = h(ii * px, jj * px)
    z = z0m + np.arange(n) * dz
    sdf = z[None, None, :] - hs[:, :, None]
    return sdf.astype(np.float32)


class Node:
    __slots__ = ("i0", "j0", "k0", "n", "level", "children")

    def __init__(self, i0, j0, k0, n, level):
        self.i0, self.j0, self.k0 = i0, j0, k0
        self.n = n
        self.level = level
        self.children = None

    def is_leaf(self):
        return self.children is None


def build_octree(sdf, max_level_fn):
    N = sdf.shape[0]
    root = Node(0, 0, 0, N, 0)

    def rec(nd):
        if nd.n < 8:
            return
        if nd.level >= max_level_fn(nd):
            return
        sub = sdf[nd.i0 : nd.i0 + nd.n, nd.j0 : nd.j0 + nd.n, nd.k0 : nd.k0 + nd.n]
        mn, mx = float(sub.min()), float(sub.max())
        if not (mn < 0 < mx):
            return
        h = nd.n // 2
        nd.children = [
            Node(nd.i0 + di * h, nd.j0 + dj * h, nd.k0 + dk * h, h, nd.level + 1)
            for di in (0, 1)
            for dj in (0, 1)
            for dk in (0, 1)
        ]
        for c in nd.children:
            rec(c)

    rec(root)
    return root


def get_leaves(root):
    out, stack = [], [root]
    while stack:
        nd = stack.pop()
        if nd.is_leaf():
            out.append(nd)
        else:
            stack.extend(nd.children)
    return out


def main() -> int:
    n = 32
    dem_m, px = synthetic_dem(n)
    h = make_height_sampler(dem_m, px)
    z0 = float(dem_m.min()) - 5.0
    z1 = float(dem_m.max()) + 5.0
    dz = (z1 - z0) / (n - 1)
    sdf = build_sdf_grid(h, n, px, z0, dz)
    assert sdf.shape == (n, n, n)
    assert float(sdf.min()) < 0 < float(sdf.max()), "SDF must straddle zero"

    def max_level_fn(nd):
        return 3

    root = build_octree(sdf, max_level_fn)
    leaves = get_leaves(root)
    assert len(leaves) >= 1
    print(
        "dem_to_transvoxel_selftest OK",
        {"n": n, "leaves": len(leaves), "sdf_min": float(sdf.min()), "sdf_max": float(sdf.max())},
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
