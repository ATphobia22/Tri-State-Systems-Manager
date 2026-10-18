#!/usr/bin/env python3
"""Regression tests for conservative HLOD geometric-error propagation."""
from __future__ import annotations

import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_hlod_tileset import Item, Q, V  # noqa: E402


def item(x: float, y: float, error: float) -> Item:
    tile = {"geometricError": error, "boundingVolume": {"box": [x, y, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]}}
    center = V(x, y, 0)
    return Item(tile=tile, sid=None, center=center,
                lo=V(x - 1, y - 1, -1), hi=V(x + 1, y + 1, 1))


class HlodGeometricErrorTests(unittest.TestCase):
    def test_internal_error_is_maximum_declared_error_in_subtree(self) -> None:
        root = Q([item(-10, -10, 8.0), item(10, 10, 2.0)], 0, 1, 4, 1.0)
        tree = root.tile(1.0)
        self.assertEqual(tree["geometricError"], 8.0)
        child_errors = [child["geometricError"] for child in tree["children"]]
        self.assertEqual(sorted(child_errors), [2.0, 8.0])
        self.assertTrue(all(tree["geometricError"] >= child for child in child_errors))

    def test_depth_does_not_artificially_reduce_error(self) -> None:
        items = [item(-20, -20, 12.0), item(-10, -10, 6.0),
                 item(10, 10, 3.0), item(20, 20, 1.0)]
        root = Q(items, 0, 1, 5, 0.5)
        tree = root.tile(0.5)
        self.assertEqual(tree["geometricError"], 12.0)

        def assert_finite_nonnegative(node: dict) -> None:
            error = node["geometricError"]
            self.assertIsInstance(error, (int, float))
            self.assertFalse(isinstance(error, bool))
            self.assertTrue(math.isfinite(error))
            self.assertGreaterEqual(error, 0)
            for child in node.get("children", []):
                self.assertGreaterEqual(error, child["geometricError"])
                assert_finite_nonnegative(child)

        assert_finite_nonnegative(tree)

    def test_invalid_source_error_fails_closed(self) -> None:
        with self.assertRaises(ValueError):
            Q([item(0, 0, float("nan"))], 0, 1, 4, 1.0)
        with self.assertRaises(ValueError):
            Q([item(0, 0, -1.0)], 0, 1, 4, 1.0)
        with self.assertRaises(ValueError):
            Q([item(0, 0, 1.0)], 0, 1, 4, float("nan"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
