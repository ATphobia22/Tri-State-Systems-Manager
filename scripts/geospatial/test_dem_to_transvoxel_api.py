#!/usr/bin/env python3
"""Contract and synthetic tests for the importable DEM-to-Transvoxel bridge."""
from __future__ import annotations

import importlib
import sys
import unittest
from pathlib import Path

import numpy as np

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
import dem_to_transvoxel as bridge


class ProductionBridgeContractTests(unittest.TestCase):
    def test_downstream_consumers_import_without_local_dem(self):
        importlib.import_module("transvoxel_complete")
        importlib.import_module("transvoxel_stitch_poc")
        self.assertTrue(callable(bridge.load_dem_window))
        self.assertTrue(callable(bridge.make_height_sampler))
        self.assertTrue(callable(bridge.build_sdf_grid))
        self.assertTrue(callable(bridge.build_octree))
        self.assertTrue(callable(bridge.get_leaves))
        self.assertTrue(callable(bridge.leaf_at))
        self.assertTrue(callable(bridge.face_neighbor_max_level))
        self.assertTrue(callable(bridge.balance_octree))

    def test_synthetic_dem_to_sdf_octree_and_lookup(self):
        n, px = 32, 2.0
        yy, xx = np.mgrid[0:n, 0:n]
        dem = 100.0 + 8.0 * np.exp(-((xx - n / 2) ** 2 + (yy - n / 2) ** 2) / (2 * (n / 6) ** 2))
        height = bridge.make_height_sampler(dem, px)
        z0, z1 = float(dem.min()) - 5.0, float(dem.max()) + 5.0
        sdf = bridge.build_sdf_grid(height, n, px, z0, (z1 - z0) / (n - 1))
        self.assertEqual(sdf.shape, (n, n, n))
        self.assertLess(float(sdf.min()), 0.0)
        self.assertGreater(float(sdf.max()), 0.0)

        root = bridge.build_octree(sdf, lambda node: 3)
        self.assertEqual(root.n, n)
        leaves = bridge.get_leaves(root)
        self.assertGreater(len(leaves), 1)
        leaf = bridge.leaf_at(root, 3, 3, 3)
        self.assertIsNotNone(leaf)
        self.assertTrue(any(item is leaf for item in leaves))
        self.assertIsNone(bridge.leaf_at(root, -1, 0, 0))
        neighbor_level = bridge.face_neighbor_max_level(root, leaf, "+x")
        if leaf.i0 + leaf.n >= n:
            self.assertEqual(neighbor_level, -1)
        else:
            self.assertGreaterEqual(neighbor_level, 0)
        balanced = bridge.balance_octree(root)
        self.assertIs(balanced, root)
        self.assertTrue(bridge.get_leaves(balanced))

    def test_transvoxel_coarse_corners_reuse_official_fine_corner_samples(self):
        from transvoxel_transition_mesh import _transition_endpoint_sample_index
        self.assertEqual([_transition_endpoint_sample_index(i) for i in range(9, 13)], [0, 2, 6, 8])

    def test_neighbor_query_rejects_unknown_face(self):
        root = bridge.Node(0, 0, 0, 8, 0)
        with self.assertRaisesRegex(ValueError, "unknown face"):
            bridge.face_neighbor_max_level(root, root, "north")

    def test_height_sampler_rejects_extrapolation_and_nonfinite_inputs(self):
        height = bridge.make_height_sampler(np.arange(16, dtype=float).reshape(4, 4), 2.0)
        self.assertAlmostEqual(height(2.0, 2.0), 5.0)
        with self.assertRaisesRegex(ValueError, "outside DEM window"):
            height(8.0, 0.0)
        with self.assertRaisesRegex(ValueError, "finite"):
            height(float("nan"), 0.0)

    def test_missing_dem_path_fails_with_actionable_error(self):
        with self.assertRaisesRegex(FileNotFoundError, "set TSM_DEM_PATH"):
            bridge.load_dem_window(SCRIPT_DIR / "definitely-missing-dem.tif", 0, 0, 8)

    def test_invalid_sdf_and_octree_inputs_fail_closed(self):
        with self.assertRaisesRegex(ValueError, "finite cubic"):
            bridge.build_octree(np.full((8, 8, 8), np.nan), lambda node: 1)
        with self.assertRaisesRegex(ValueError, "power of two"):
            bridge.build_octree(np.zeros((7, 7, 7)), lambda node: 1)
        with self.assertRaisesRegex(ValueError, "positive finite"):
            bridge.build_sdf_grid(lambda x, y: np.zeros_like(x), 8, 0.0, 0.0, 1.0)


if __name__ == "__main__":
    unittest.main()
