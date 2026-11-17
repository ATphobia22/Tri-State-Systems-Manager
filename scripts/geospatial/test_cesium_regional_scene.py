from pathlib import Path
import struct
from tempfile import TemporaryDirectory
import unittest

import numpy as np

from build_cesium_regional_scene import POSTS, river_access_elevation, write_screening_png
from verify_cesium_regional_scene import verify_terrain_level


class CityScreeningTests(unittest.TestCase):
    def test_visual_raster_matches_exact_connected_cells_without_extra_dependencies(self):
        # A transparent, bounded Cesium single image must encode precisely the
        # same connected-cell mask as the audited GeoJSON polygon archive.
        import rasterio
        mask = np.array([[True, False, True], [False, True, False]], dtype=bool)
        with TemporaryDirectory() as temporary:
            image = Path(temporary) / "screening.png"
            write_screening_png(image, mask)
            self.assertEqual(image.read_bytes()[:8], b"\x5c\x78\x38\x39PNG\x5c\x72\x5c\x6e\x5c\x78\x31\x61\x5c\x6e")
            with rasterio.open(image) as dataset:
                self.assertEqual((dataset.width, dataset.height, dataset.count), (3, 2, 4))
                bands = dataset.read()
                np.testing.assert_array_equal(bands[3] > 0, mask)
                np.testing.assert_array_equal(bands[3], mask.astype(np.uint8) * 136)
                self.assertTrue((bands[0] == 35).all())
                self.assertTrue((bands[1] == 186).all())
                self.assertTrue((bands[2] == 242).all())

    def test_screening_raster_rejects_empty_or_non_boolean_masks(self):
        with TemporaryDirectory() as temporary:
            out = Path(temporary) / "extent.png"
            with self.assertRaises(ValueError):
                write_screening_png(out, np.zeros((0, 4), dtype=bool))
            with self.assertRaises(ValueError):
                write_screening_png(out, np.ones((2, 2), dtype=np.uint8))

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


class RegionalTerrainVerificationTests(unittest.TestCase):
    def test_checks_both_terrain_axes_and_rejects_a_single_bad_shared_post(self):
        area = {"startX": 2, "endX": 3, "startY": 5, "endY": 6}
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            for x in range(2, 4):
                (root / str(x)).mkdir()
                for y in range(5, 7):
                    posts = [
                        x * (POSTS - 1) + column + (y + 1) * (POSTS - 1) - row
                        for row in range(POSTS)
                        for column in range(POSTS)
                    ]
                    (root / str(x) / f"{y}.terrain").write_bytes(
                        struct.pack(f"<{len(posts)}H", *posts) + b"\0\0",
                    )
            files, edges = verify_terrain_level(root, area, None)
            self.assertEqual((len(files), edges), (4, 4))
            tile = root / "3/6.terrain"
            original = tile.read_bytes()
            for offset, axis in ((0, "East-west"), (2 * (POSTS*POSTS - 1), "North-south")):
                corrupt = bytearray(original)
                corrupt[offset] ^= 1
                tile.write_bytes(corrupt)
                with self.assertRaisesRegex(ValueError, axis):
                    verify_terrain_level(root, area, None)
