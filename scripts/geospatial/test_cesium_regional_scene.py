from pathlib import Path
import struct
from tempfile import TemporaryDirectory
import unittest

import numpy as np

from build_cesium_regional_scene import POSTS, river_access_elevation, road_name_labels, write_screening_png
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
            self.assertEqual(image.read_bytes()[:8], b"\x89PNG\r\n\x1a\n")
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


def _road(name, county, mtfcc, coords):
    return {
        "type": "Feature",
        "id": f"TIGER2024:{county}:{name or 'unnamed'}:{abs(hash((name, county, coords[0][0]))) % 100000}",
        "geometry": {"type": "LineString", "coordinates": coords},
        "properties": {"name": name, "county_geoid": county, "mtfcc": mtfcc},
    }


class RoadNameLabelTests(unittest.TestCase):
    def test_segments_with_one_name_cluster_into_one_label_at_the_longest_segment(self):
        features = [
            _road("Main St", "18129", "S1400", [[-88.0, 37.85], [-88.01, 37.85]]),
            _road("Main St", "18129", "S1400", [[-88.02, 37.85], [-88.05, 37.85]]),
        ]
        labels = road_name_labels(features)
        self.assertEqual(len(labels), 1)
        label = labels[0]
        self.assertEqual(label["name"], "Main St")
        self.assertEqual(label["tier"], "local")
        self.assertEqual(label["segments"], 2)
        # Midpoint vertex of the longer second segment (its far vertex here).
        self.assertAlmostEqual(label["lon"], -88.05)
        self.assertAlmostEqual(label["lat"], 37.85)

    def test_major_tier_follows_the_seed_segment_mtfcc(self):
        features = [_road("State Rd 62", "18129", "S1200", [[-88.0, 37.85], [-88.02, 37.85]])]
        labels = road_name_labels(features)
        self.assertEqual(labels[0]["tier"], "major")

    def test_unnamed_segments_never_produce_a_label(self):
        features = [
            _road("", "18129", "S1400", [[-88.0, 37.85], [-88.01, 37.85]]),
            _road(None, "18129", "S1400", [[-88.02, 37.85], [-88.03, 37.85]]),
        ]
        self.assertEqual(road_name_labels(features), [])

    def test_same_name_in_two_counties_produces_two_labels_with_stable_ids(self):
        features = [
            _road("Main St", "18129", "S1400", [[-88.0, 37.85], [-88.01, 37.85]]),
            _road("Main St", "18163", "S1400", [[-87.6, 37.97], [-87.61, 37.97]]),
        ]
        first = road_name_labels(features)
        second = road_name_labels(list(reversed(features)))
        self.assertEqual(len(first), 2)
        self.assertEqual([f["id"] for f in first], [f["id"] for f in second])
        self.assertEqual(len({f["id"] for f in first}), 2)

    def test_user_decision_overrides_show_the_agreed_names_and_keep_tiger_name(self):
        # Decided 2026-11-19: OSM + IndianaMap agree against TIGER here.
        features = [
            _road("Co Rd 400 E", "18129", "S1400", [[-88.0, 37.85], [-88.01, 37.85]]),
            _road("Co Rd 500 E", "18129", "S1400", [[-88.02, 37.85], [-88.03, 37.85]]),
            _road("W 2nd St", "18129", "S1400", [[-88.04, 37.85], [-88.05, 37.85]]),
        ]
        labels = road_name_labels(features)
        self.assertEqual({label["name"] for label in labels},
                         {"Lamont Road", "Pumpkin Run Road", "Pearl Street"})
        self.assertEqual({label["tiger_name"] for label in labels},
                         {"Co Rd 400 E", "Co Rd 500 E", "W 2nd St"})

    def test_split_conflicts_keep_their_tiger_names(self):
        # Same 2026-11-19 decision: split sources keep TIGER everywhere else.
        features = [
            _road("Blaylock Rd", "18129", "S1400", [[-88.0, 37.85], [-88.01, 37.85]]),
            _road("Gum St", "18129", "S1400", [[-88.02, 37.85], [-88.03, 37.85]]),
            _road("Big Barn Rd", "17059", "S1400", [[-88.04, 37.85], [-88.05, 37.85]]),
            _road("Co Rd 10", "17193", "S1400", [[-88.06, 37.85], [-88.07, 37.85]]),
        ]
        labels = road_name_labels(features)
        self.assertEqual({label["name"] for label in labels},
                         {"Blaylock Rd", "Gum St", "Big Barn Rd", "Co Rd 10"})
        self.assertTrue(all("tiger_name" not in label for label in labels))
