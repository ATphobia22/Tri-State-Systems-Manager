#!/usr/bin/env python3
"""Regression tests for the JSON-to-Transvoxel transition mesher adapter."""
from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("dem_to_transvoxel.py")
sys.path.insert(0, str(MODULE_PATH.parent))
SPEC = importlib.util.spec_from_file_location("dem_to_transvoxel_cli", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Unable to load DEM-to-Transvoxel adapter")
MESHER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MESHER)


class DemToTransvoxelAdapterTests(unittest.TestCase):
    def _cell(self, direction: int = 1) -> dict:
        fine = [-1.0 if index in (0, 1, 4) else 1.0 for index in range(9)]
        return {
            "origin": [0.0, 0.0, 0.0],
            "axis": 0,
            "direction": direction,
            "extent": 1.0,
            "samples": fine,
        }

    def test_polygonizes_nine_samples_using_official_case_bits_and_orients_both_faces(self):
        results = []
        for direction in (-1, 1):
            cell = self._cell(direction)
            result = MESHER._polygonize(cell)
            # Samples 0, 1, and 4 are negative. Lengyel's published case-bit
            # order maps these to bits 0x001, 0x002, and 0x100 (not 1 << i).
            self.assertEqual(result["case"], 0x001 | 0x002 | 0x100)
            self.assertGreater(result["vertexCount"], 0)
            self.assertGreater(result["triangleCount"], 0)
            self.assertEqual(len(result["triangles"]), result["triangleCount"])
            self.assertTrue(all(0 <= index < result["vertexCount"] for tri in result["triangles"] for index in tri))
            self.assertTrue(all(len(vertex) == 3 for vertex in result["vertices"]))
            results.append(result)
        self.assertNotEqual(results[0]["vertices"], results[1]["vertices"])

    def test_rejects_wrong_scalar_count_and_non_finite_values(self):
        cell = self._cell()
        cell["samples"] = cell["samples"][:-1]
        with self.assertRaisesRegex(ValueError, "exactly 9 fine-side scalar samples"):
            MESHER._polygonize(cell)
        cell = self._cell()
        cell["samples"][4] = float("nan")
        with self.assertRaisesRegex(ValueError, r"samples\[4\] must be a finite number"):
            MESHER._polygonize(cell)

    def test_rejects_invalid_axis_direction_and_extent(self):
        cell = self._cell()
        cell["axis"] = 3
        with self.assertRaisesRegex(ValueError, "axis"):
            MESHER._polygonize(cell)
        cell = self._cell()
        cell["direction"] = 0
        with self.assertRaisesRegex(ValueError, "direction"):
            MESHER._polygonize(cell)
        cell = self._cell()
        cell["extent"] = 0
        with self.assertRaisesRegex(ValueError, "extent"):
            MESHER._polygonize(cell)


if __name__ == "__main__":
    unittest.main()
