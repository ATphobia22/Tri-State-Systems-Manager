#!/usr/bin/env python3
"""Regression: COPC tiles are decompressed once per tile, not once per building."""
from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np

from scripts.geospatial import extract_derived_heights_copc as copc


class CopcTileReuseTests(unittest.TestCase):
    def setUp(self):
        self.ring = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0),
                     (0.0, 10.0), (0.0, 0.0)]
        # 10 ground returns at 100 ft and 10 footprint-clipped Class 1
        # roof returns at 120 ft, meeting the unmodified extraction thresholds.
        self.las = SimpleNamespace(
            x=np.array([5.0] * 20),
            y=np.array([5.0] * 20),
            z=np.array([100.0] * 10 + [120.0] * 10),
            classification=np.array([2] * 10 + [1] * 10),
        )

    def test_multiple_buildings_share_one_decompression(self):
        with patch.object(copc.laspy, "read", return_value=self.las) as read:
            arrays = copc.load_tile_arrays("one-tile.copc.laz")
            first = copc.extract_derived_height("one-tile.copc.laz", self.ring, arrays)
            second = copc.extract_derived_height("one-tile.copc.laz", self.ring, arrays)
            read.assert_called_once_with("one-tile.copc.laz")
        self.assertEqual(first["lidarHeightStatus"], "OK")
        self.assertEqual(first["heightProvenance"], "DERIVED")
        self.assertEqual(first["lidarHeightFt"], 20.0)
        self.assertEqual(first, second)

    def test_backward_compatible_single_building_path(self):
        with patch.object(copc.laspy, "read", return_value=self.las) as read:
            result = copc.extract_derived_height("tile.laz", self.ring)
            read.assert_called_once_with("tile.laz")
        self.assertEqual(result["lidarHeightStatus"], "OK")

    def test_unreadable_tile_is_explicitly_unavailable(self):
        with patch.object(copc.laspy, "read", side_effect=OSError("corrupt tile")):
            result = copc.extract_derived_height("tile.laz", self.ring)
        self.assertEqual(result["lidarHeightStatus"], "error:tile-read-failed:corrupt tile")


if __name__ == "__main__":
    unittest.main()
