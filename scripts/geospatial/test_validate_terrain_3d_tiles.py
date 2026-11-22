"""OGC 3D Tiles 1.1 geographic bounding-volume contract regression tests."""
from __future__ import annotations

import importlib.util
import math
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location(
    "tsm_terrain_validator", Path(__file__).with_name("validate-terrain-3d-tiles.py")
)
assert SPEC is not None and SPEC.loader is not None
VALIDATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VALIDATOR)


class TerrainBoundingVolumeTests(unittest.TestCase):
    def check(self, volume, error=0):
        uris = []
        VALIDATOR.walk(
            {"boundingVolume": volume, "geometricError": error, "children": []},
            uris,
        )
        self.assertEqual(uris, [])

    def test_box_and_sphere_remain_supported(self):
        self.check({"box": [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]}, 1.0)
        self.check({"sphere": [0, 0, 0, 500]}, 2)

    def test_region_radians_meters(self):
        self.check({"region": [-1.54, 0.65, -1.52, 0.67, 100, 150]}, 5.0)

    def test_antimeridian_region_is_legitimate(self):
        self.check({"region": [3.12, -0.10, -3.12, 0.10, -20, 0]})

    def test_reject_missing_multiple_or_unsupported_volume(self):
        for volume in ({}, {"cylinder": [0, 0, 1]}, {
            "sphere": [0, 0, 0, 1], "region": [0, 0, 0, 0, 0, 0]
        }):
            with self.subTest(volume=volume), self.assertRaises(ValueError):
                self.check(volume)

    def test_reject_wrong_length_nonfinite_and_boolean_values(self):
        for values in (
            [0, 0, 0, 1, 0],
            [0, 0, 0, 1, 0, float("nan")],
            [0, 0, 0, 1, 0, float("inf")],
            [0, 0, 0, 1, False, 2],
        ):
            with self.subTest(values=values), self.assertRaises(ValueError):
                self.check({"region": values})

    def test_reject_invalid_latitude_and_height_order(self):
        for values in (
            [0, -2, 0.1, 0.1, 0, 1],
            [0, 0.2, 0.1, 0.1, 0, 1],
            [0, 0, 0.1, 0.1, 10, 1],
            [-4, 0, 0.1, 0.1, 0, 1],
        ):
            with self.subTest(values=values), self.assertRaises(ValueError):
                self.check({"region": values})

    def test_reject_invalid_sphere_radius_and_nonfinite_box(self):
        with self.assertRaises(ValueError):
            self.check({"sphere": [0, 0, 0, -1]})
        with self.assertRaises(ValueError):
            self.check({"box": [math.inf] + [0] * 11})

    def test_reject_negative_nonfinite_and_boolean_geometric_error(self):
        for error in (-1, math.nan, math.inf, True):
            with self.subTest(error=error), self.assertRaises(ValueError):
                self.check({"sphere": [0, 0, 0, 1]}, error)

    def test_nested_region_and_box_tree(self):
        tree = {
            "boundingVolume": {"region": [-1.54, 0.65, -1.52, 0.67, 100, 150]},
            "geometricError": 10,
            "children": [{
                "boundingVolume": {"box": [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]},
                "geometricError": 0,
                "children": [],
            }],
        }
        VALIDATOR.walk(tree, [])


if __name__ == "__main__":
    unittest.main()
