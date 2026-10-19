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


def item(source_id: int, x: float, y: float, error: float) -> Item:
    tile = {
        "geometricError": error,
        "boundingVolume": {"box": [x, y, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]},
        "content": {"uri": f"source-{source_id}.glb"},
        "extras": {"tsm": {"sourceObjectId": source_id}},
    }
    center = V(x, y, 0)
    return Item(tile=tile, sid=source_id, center=center,
                lo=V(x - 1, y - 1, -1), hi=V(x + 1, y + 1, 1))


def walk(node: dict):
    yield node
    for child in node.get("children", []):
        yield from walk(child)


class HlodGeometricErrorTests(unittest.TestCase):
    def test_internal_error_is_maximum_of_fallback_and_descendant_errors(self) -> None:
        root = Q([item(1, -10, -10, 8.0), item(2, 10, 10, 2.0)], 0, 1, 4, 1.0)
        tree = root.tile(1.0)
        self.assertEqual(tree["geometricError"], 8.0)
        child_errors = [child["geometricError"] for child in tree["children"]]
        self.assertEqual(sorted(child_errors), [8.0, 8.0])
        self.assertTrue(all(child >= tree["geometricError"] for child in child_errors))

    def test_empty_nodes_keep_fallback_floor_and_leaves_keep_source_errors(self) -> None:
        coords = [
            (-20.0, -20.0), (-10.0, -10.0), (10.0, 10.0), (20.0, 20.0),
            (-18.0, -18.0), (-12.0, -12.0), (12.0, 12.0), (18.0, 18.0),
        ]
        errors = [0.0, 0.25, 0.0, 1.5, 0.0, 0.0, 3.0, 0.0]
        items = [item(index + 1, x, y, errors[index])
                 for index, (x, y) in enumerate(coords)]
        fallback = 12.0
        tree = Q(items, 0, 1, 5, fallback).tile(fallback)
        nodes = list(walk(tree))
        empty_nodes = [node for node in nodes if "content" not in node]
        self.assertGreater(len(empty_nodes), 1, "fixture must cover nested empty nodes")
        for node in empty_nodes:
            self.assertGreaterEqual(node["geometricError"], fallback)
            for child in node.get("children", []):
                if "content" not in child:
                    self.assertGreaterEqual(child["geometricError"], node["geometricError"])

        expected = {obj.tile["content"]["uri"]: obj.tile["geometricError"] for obj in items}
        actual = {
            node["content"]["uri"]: node["geometricError"]
            for node in nodes if "content" in node
        }
        self.assertEqual(actual, expected)

        def assert_valid_and_conservative(node: dict) -> None:
            error = node["geometricError"]
            self.assertIsInstance(error, (int, float))
            self.assertNotIsInstance(error, bool)
            self.assertTrue(math.isfinite(error))
            self.assertGreaterEqual(error, 0)
            for child in node.get("children", []):
                self.assertGreaterEqual(error, child["geometricError"])
                assert_valid_and_conservative(child)

        assert_valid_and_conservative(tree)

    def test_tree_is_deterministic(self) -> None:
        points = [item(1, -10, -10, 8.0), item(2, 10, 10, 2.0)]
        first = Q(points, 0, 1, 4, 1.0).tile(1.0)
        second_points = [item(1, -10, -10, 8.0), item(2, 10, 10, 2.0)]
        second = Q(second_points, 0, 1, 4, 1.0).tile(1.0)
        self.assertEqual(first, second)

    def test_invalid_source_and_fallback_errors_resilient(self) -> None:
        for bad_error in (-1.0, float("nan"), float("inf"), True):
            with self.subTest(source_error=bad_error):
                with self.assertRaises(ValueError):
                    Q([item(1, 0, 0, bad_error)], 0, 1, 4, 1.0)

        for bad_fallback in (-1.0, float("nan"), float("inf"), True):
            with self.subTest(fallback_error=bad_fallback):
                with self.assertRaises(ValueError):
                    Q([item(1, 0, 0, 1.0)], 0, 1, 4, bad_fallback)


if __name__ == "__main__":
    unittest.main(verbosity=2)
