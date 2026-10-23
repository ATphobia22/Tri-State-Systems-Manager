#!/usr/bin/env python3
"""Synthetic DEM → production DEM bridge → SDF → balanced octree test."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dem_to_transvoxel import (
    Node,
    balance_octree,
    build_octree,
    build_sdf_grid,
    get_leaves,
    leaf_at,
    make_height_sampler,
)


def main() -> int:
    n, px = 32, 2.0
    yy, xx = np.mgrid[0:n, 0:n]
    dem_m = 100.0 + 8.0 * np.exp(
        -((xx - n / 2) ** 2 + (yy - n / 2) ** 2) / (2 * (n / 6) ** 2)
    )
    height = make_height_sampler(dem_m, px)
    z0, z1 = float(dem_m.min()) - 5.0, float(dem_m.max()) + 5.0
    sdf = build_sdf_grid(height, n, px, z0, (z1 - z0) / (n - 1))
    assert sdf.shape == (n, n, n)
    assert float(sdf.min()) < 0 < float(sdf.max())

    root = build_octree(sdf, lambda node: 3)
    assert isinstance(root, Node)
    leaves = get_leaves(root)
    assert len(leaves) > 1
    assert leaf_at(root, 3, 3, 3) in leaves
    assert leaf_at(root, -1, 0, 0) is None
    balanced = balance_octree(root)
    assert balanced is root
    print("production DEM bridge synthetic test: PASS", {
        "grid": list(sdf.shape),
        "leaf_count": len(get_leaves(root)),
        "sdf_min_m": float(sdf.min()),
        "sdf_max_m": float(sdf.max()),
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
