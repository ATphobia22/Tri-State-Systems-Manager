import unittest

import numpy as np

from build_cesium_regional_scene import river_access_elevation


class CityScreeningTests(unittest.TestCase):
    def test_river_connection_requires_crossing_lowest_ridge_opening(self):
        elevation = np.array([[2, 9, 3], [2, 5, 3], [2, 9, 3]])
        seed = np.zeros_like(elevation, dtype=bool)
        seed[1, 0] = True
        minimum = river_access_elevation(elevation, seed)
        np.testing.assert_array_equal(minimum, [[2, 9, 5], [2, 5, 5], [2, 9, 5]])

    def test_no_diagonal_path_or_seeding_distant_low_spot(self):
        elevation = np.array([[1, 8], [7, 1]])
        seed = np.array([[True, False], [False, False]])
        self.assertEqual(river_access_elevation(elevation, seed)[1, 1], 7)

    def test_missing_river_and_invalid_elevation_cannot_generate_extents(self):
        seed = np.array([[False]])
        with self.assertRaises(ValueError):
            river_access_elevation(np.array([[2]]), seed)
        with self.assertRaises(ValueError):
            river_access_elevation(np.array([[np.nan]]), ~seed)
