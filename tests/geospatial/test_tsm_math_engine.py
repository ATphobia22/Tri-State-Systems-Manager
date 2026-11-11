"""Focused regression tests for the TSM scientific math primitives."""
import math
import unittest

import numpy as np

from scripts.geospatial.tsm_math_engine import TSMMathEngine as E


class TestTSMMathEngine(unittest.TestCase):
    def test_geodetic_ecef_roundtrips(self):
        for lat, lon, h in [(37.84589, -88.00510, 120.0),
                             (0, 0, 0), (89.9999, -150, 250),
                             (-45, 120, -40), (90, 0, 100)]:
            x, y, z = E.geodetic_to_ecef(lat, lon, h)
            a, b, c = E.ecef_to_geodetic(x, y, z)
            self.assertAlmostEqual(lat, a, places=7)
            if abs(lat) < 90:
                self.assertAlmostEqual(lon, b, places=7)
            self.assertAlmostEqual(h, c, places=4)

    def test_reference_equator(self):
        self.assertTrue(np.allclose(E.geodetic_to_ecef(0, 0, 0),
                                    [6378137, 0, 0], rtol=0, atol=1e-8))

    def test_invalid_geodesy(self):
        with self.assertRaises(ValueError):
            E.ecef_to_geodetic(0, 0, 0)
        with self.assertRaises(ValueError):
            E.geodetic_to_ecef(91, 0, 0)
        with self.assertRaises(ValueError):
            E.geodetic_to_ecef(0, math.nan, 0)

    def test_column_major_enu_matrix_and_anchor(self):
        lat, lon, h = 37.84589, -88.00510, 120
        raw = E.build_ogc_tileset_transform_matrix(lat, lon, h)
        self.assertTrue(E.verify_rotation_orthonormality(raw))
        m = np.asarray(raw).reshape((4, 4), order="F")
        np.testing.assert_allclose(m[:3, 3], E.geodetic_to_ecef(lat, lon, h), atol=1e-8)
        np.testing.assert_allclose(m[:3, :3].T @ m[:3, :3], np.eye(3), atol=1e-12)
        self.assertFalse(E.verify_rotation_orthonormality(raw[:-1]))
        corrupted = raw.copy()
        corrupted[0] = 2.0
        self.assertFalse(E.verify_rotation_orthonormality(corrupted))

    def test_geoid18_contract(self):
        result = E.transform_ellipsoidal_to_orthometric(
            120, -30.302, "GEOID18", "https://www.ngs.noaa.gov/GEOID/GEOID18/")
        self.assertAlmostEqual(result["orthometric_height_navd88_m"], 150.302)
        with self.assertRaises(ValueError):
            E.transform_ellipsoidal_to_orthometric(120, -30, "GEOID18",
                "https://www.ngs.noaa.gov/", source_frame="WGS84")
        with self.assertRaises(ValueError):
            E.transform_ellipsoidal_to_orthometric(120, -30, "GEOID18",
                "https://www.ngs.noaa.gov/", reference_epoch="2026.00")

    def test_obb_contains_all_points(self):
        pts = np.array([[1,2,3], [4,5,6], [5,-2,3], [-3,9,-4]], dtype=float) + [1e6, -5e6, 3e6]
        result = E.compute_oriented_bounding_box(pts)
        box = result["ogc_3d_tiles_box"]
        self.assertEqual(len(box), 12)
        c = np.array(box[:3])
        half_axes = np.array(box[3:]).reshape((3, 3)).T
        normalized_axes = np.column_stack(
            [half_axes[:,i] / np.linalg.norm(half_axes[:,i]) for i in range(3)])
        coordinates = (pts-c) @ normalized_axes
        bounds = np.array(result["half_extents"])
        self.assertTrue(np.all(np.abs(coordinates) <= bounds + 1e-8))
        self.assertEqual(len(E.compute_oriented_bounding_box(np.array([[1,2,3]]))["ogc_3d_tiles_box"]),12)
        with self.assertRaises(ValueError):
            E.compute_oriented_bounding_box(np.empty((0,3)))

    def test_manning(self):
        v = E.compute_manning_open_channel_velocity(2.5, 0.001, 0.035)
        expected = (2.5**(2/3))*math.sqrt(0.001)/0.035
        self.assertAlmostEqual(v, expected, places=12)
        with self.assertRaises(ValueError):
            E.compute_manning_open_channel_velocity(2.5, -0.01, .035)


if __name__ == "__main__":
    unittest.main()
