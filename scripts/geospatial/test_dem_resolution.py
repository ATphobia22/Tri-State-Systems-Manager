#!/usr/bin/env python3
"""Dependency-free tests for physical DEM-resolution ordering in mixed CRSs."""
from __future__ import annotations

import unittest
from types import SimpleNamespace

from dem_resolution import RasterResolutionError, ground_pixel_resolution_m

BOUNDS = SimpleNamespace(bottom=37.8, top=37.9)
FT_US_M = 1200 / 3937


class DemResolutionTests(unittest.TestCase):
    def test_state_plane_us_survey_feet_are_converted_to_metres(self):
        crs = SimpleNamespace(is_projected=True, is_geographic=False,
                              linear_units_factor=("US survey foot", FT_US_M))
        self.assertAlmostEqual(ground_pixel_resolution_m(crs, (2.5, 2.5), BOUNDS),
                               2.5 * FT_US_M, places=8)

    def test_geographic_dem_degrees_are_converted_at_posey_latitude(self):
        crs = SimpleNamespace(is_projected=False, is_geographic=True)
        spacing = ground_pixel_resolution_m(crs, (1 / 10800, 1 / 10800), BOUNDS)
        self.assertGreater(spacing, 10.0)
        self.assertLess(spacing, 11.0)

    def test_fine_state_plane_tile_sorts_before_coarse_geographic_raster(self):
        feet = SimpleNamespace(is_projected=True, is_geographic=False,
                                linear_units_factor=("US survey foot", FT_US_M))
        geographic = SimpleNamespace(is_projected=False, is_geographic=True)
        fine = ground_pixel_resolution_m(feet, (2.5, 2.5), BOUNDS)
        coarse = ground_pixel_resolution_m(geographic, (1 / 10800, 1 / 10800), BOUNDS)
        self.assertLess(fine, coarse)

    def test_projected_metre_raster_retains_metre_spacing(self):
        crs = SimpleNamespace(is_projected=True, is_geographic=False,
                              linear_units_factor=("metre", 1.0))
        self.assertEqual(ground_pixel_resolution_m(crs, (1.0, 1.0), BOUNDS), 1.0)

    def test_missing_crs_and_invalid_units_do_not_guess(self):
        feet = SimpleNamespace(is_projected=True, is_geographic=False,
                                linear_units_factor=("foot", 0.3048))
        with self.assertRaises(RasterResolutionError):
            ground_pixel_resolution_m(None, (2.5, 2.5), BOUNDS)
        for values in ((0, 1), (float("nan"), 1), (float("inf"), 1), (True, 1)):
            with self.subTest(values=values), self.assertRaises(RasterResolutionError):
                ground_pixel_resolution_m(feet, values, BOUNDS)
        unknown = SimpleNamespace(is_projected=False, is_geographic=False)
        with self.assertRaises(RasterResolutionError):
            ground_pixel_resolution_m(unknown, (1, 1), BOUNDS)


if __name__ == "__main__":
    unittest.main()
