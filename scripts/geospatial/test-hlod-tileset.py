#!/usr/bin/env python3
"""Regression tests for HLOD geometric-error propagation and hierarchy output.

This test uses a small synthetic tileset and only the Python standard library.
It verifies metadata consistency, not visual refinement performance in a renderer.
"""
from __future__ import annotations

import importlib.util
import json
import math
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("build-hlod-tileset.py")
SPEC = importlib.util.spec_from_file_location("build_hlod_tileset", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def ecef_offset(origin, east, north, up):
    axes = MODULE.axes(origin)
    return MODULE.V(
        origin.x + east * axes[0].x + north * axes[1].x + up * axes[2].x,
        origin.y + east * axes[0].y + north * axes[1].y + up * axes[2].y,
        origin.z + east * axes[0].z + north * axes[1].z + up * axes[2].z,
    )


def tile(center, error, source_id):
    return {
        "boundingVolume": {
            "box": [
                center.x, center.y, center.z,
                2.0, 0.0, 0.0,
                0.0, 2.0, 0.0,
                0.0, 0.0, 2.0,
            ]
        },
        "geometricError": error,
        "refine": "REPLACE",
        "content": {"uri": f"tile-{source_id}.glb"},
        "extras": {"tsm": {"sourceObjectId": source_id}},
    }


def assert_hierarchy_errors_are_conservative(test_case, node, parent_error=None):
    error = node["geometricError"]
    test_case.assertIsInstance(error, (int, float))
    test_case.assertFalse(isinstance(error, bool))
    test_case.assertTrue(math.isfinite(error))
    test_case.assertGreaterEqual(error, 0.0)
    if parent_error is not None:
        test_case.assertGreaterEqual(
            parent_error + 1e-12,
            error,
            "generated parent geometricError must not be smaller than a child",
        )
    for child in node.get("children", []):
        assert_hierarchy_errors_are_conservative(test_case, child, error)


class HlodTilesetTests(unittest.TestCase):
    def test_cli_propagates_large_source_descendant_error(self):
        # Four spatially separated fixtures force a root with intermediate
        # nodes. One source tile intentionally declares more error than the
        # root input value; generated ancestors must not understate it.
        origin = MODULE.V(150_000.0, -4_900_000.0, 3_900_000.0)
        source_tiles = []
        for source_id, (east, north, error) in enumerate(
            [
                (-100.0, -100.0, 0.25),
                (-100.0, 100.0, 0.50),
                (100.0, -100.0, 0.75),
                (100.0, 100.0, 19.0),
            ]
        ):
            source_tiles.append(
                tile(ecef_offset(origin, east, north, 0.0), error, source_id)
            )

        input_tileset = {
            "asset": {"version": "1.1"},
            "geometricError": 8.0,
            "root": {
                "boundingVolume": {"box": [origin.x, origin.y, origin.z, 500, 0, 0, 0, 500, 0, 0, 0, 100]},
                "geometricError": 8.0,
                "refine": "REPLACE",
                "children": source_tiles,
            },
        }

        with tempfile.TemporaryDirectory(prefix="tsm-hlod-test-") as temp_dir:
            temp = Path(temp_dir)
            input_path = temp / "input.json"
            output_path = temp / "output" / "tileset.json"
            input_path.write_text(json.dumps(input_tileset), encoding="utf-8")
            subprocess.run(
                [
                    sys.executable,
                    str(MODULE_PATH),
                    "--input", str(input_path),
                    "--output", str(output_path),
                    "--max-items", "1",
                    "--max-depth", "4",
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            generated = json.loads(output_path.read_text(encoding="utf-8"))

        self.assertGreaterEqual(generated["geometricError"], 19.0)
        self.assertGreaterEqual(generated["root"]["geometricError"], 19.0)
        policy = generated.get("extras", {}).get("tsm", {})
        self.assertEqual(
            policy.get("geometricErrorPolicy"),
            "max-root-depth-baseline-and-source-descendant-error-v1",
        )
        self.assertEqual(
            policy.get("geometricErrorAccuracy"),
            "REFINEMENT_HEURISTIC_NOT_MEASURED_SIMPLIFICATION_ERROR",
        )
        assert_hierarchy_errors_are_conservative(self, generated["root"])

        def assert_descendant_floor(node):
            descendants = node.get("children", [])
            descendant_errors = []
            for child in descendants:
                descendant_errors.append(child["geometricError"])
                descendant_errors.extend(assert_descendant_floor(child))
            if descendant_errors:
                self.assertGreaterEqual(
                    node["geometricError"] + 1e-12,
                    max(descendant_errors),
                )
            return descendant_errors

        assert_descendant_floor(generated["root"])

    def test_rejects_invalid_geometric_errors(self):
        for invalid in (True, -0.001, float("nan"), float("inf"), "1.0", None):
            with self.subTest(value=invalid):
                with self.assertRaises(ValueError):
                    MODULE._numeric_geometric_error(invalid, "fixture")

    def test_rejects_invalid_descendant_tree(self):
        invalid_tiles = [
            {"geometricError": -1.0},
            {"geometricError": float("nan")},
            {"geometricError": True},
            {"geometricError": 1.0, "children": {}},
            {"geometricError": 1.0, "children": [{"geometricError": -0.5}]},
        ]
        for fixture in invalid_tiles:
            with self.subTest(fixture=fixture):
                with self.assertRaises(ValueError):
                    MODULE._tree_geometric_error(fixture)


if __name__ == "__main__":
    unittest.main(verbosity=2)
