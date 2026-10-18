#!/usr/bin/env python3
"""Regression tests for conservative HLOD geometric-error propagation."""
from __future__ import annotations

import importlib.util
import math
import sys
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("build-hlod-tileset.py")
SPEC = importlib.util.spec_from_file_location("build_hlod_tileset", SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot load HLOD builder: {SCRIPT}")
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)
Item, Q, V = MODULE.Item, MODULE.Q, MODULE.V


def make_item(x: float, y: float, error: float) -> Item:
    tile = {
        "geometricError": error,
        "boundingVolume": {"box": [x, y, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]},
    }
    return Item(
        tile=tile,
        sid=None,
        center=V(x, y, 0),
        lo=V(x - 1, y - 1, -1),
        hi=V(x + 1, y + 1, 1),
    )


class HlodGeometricErrorTests(unittest.TestCase):
    def test_empty_partition_nodes_inherit_parent_error_floor(self) -> None:
        root = Q(
            [make_item(-10, -10, 2.0), make_item(10, 10, 6.0)],
            0, 1, 4, 8.0,
        )
        tree = root.tile(8.0)
        self.assertEqual(tree["geometricError"], 8.0)
        self.assertEqual(
            sorted(child["geometricError"] for child in tree["children"]),
            [8.0, 8.0],
        )
        leaf_errors = sorted(
            grandchild["geometricError"]
            for child in tree["children"]
            for grandchild in child["children"]
        )
        self.assertEqual(leaf_errors, [2.0, 6.0])

    def test_tree_depth_never_invents_lower_error_for_empty_nodes(self) -> None:
        root = Q(
            [
                make_item(-20, -20, 12.0),
                make_item(-10, -10, 6.0),
                make_item(10, 10, 3.0),
                make_item(20, 20, 1.0),
            ],
            0, 1, 5, 12.0,
        )
        tree = root.tile(12.0)

        def verify(node: dict) -> None:
            error = node["geometricError"]
            self.assertIsInstance(error, (int, float))
            self.assertNotIsInstance(error, bool)
            self.assertTrue(math.isfinite(error))
            self.assertGreaterEqual(error, 0)
            for child in node.get("children", []):
                if "content" not in node:
                    self.assertGreaterEqual(error, child["geometricError"])
                verify(child)

        self.assertEqual(tree["geometricError"], 12.0)
        verify(tree)

    def test_invalid_fallback_or_source_error_fails_closed(self) -> None:
        for invalid in (float("nan"), float("inf"), -1.0, True):
            with self.subTest(invalid=invalid):
                with self.assertRaises(ValueError):
                    Q([make_item(0, 0, 1.0)], 0, 1, 4, invalid)
        for invalid in (float("nan"), float("inf"), -1.0, True):
            with self.subTest(source_error=invalid):
                with self.assertRaises(ValueError):
                    Q([make_item(0, 0, invalid)], 0, 1, 4, 1.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
