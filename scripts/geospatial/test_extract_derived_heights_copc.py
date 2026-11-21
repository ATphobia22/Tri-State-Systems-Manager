#!/usr/bin/env python3
"""Regression: COPC tiles are decompressed once per tile, not once per building."""
from __future__ import annotations

import json
from pathlib import Path
import unittest
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

import laspy
import numpy as np
from pyproj import CRS, Transformer

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


class FootprintTopologyTests(unittest.TestCase):
    """True roof points must belong to actual footprint shells, not courtyards."""

    @staticmethod
    def ring(west, south, east, north):
        return [(west, south), (east, south), (east, north),
                (west, north), (west, south)]

    def test_polygon_hole_rejects_tree_points_in_courtyard(self):
        outer = self.ring(0, 0, 10, 10)
        hole = self.ring(4, 4, 6, 6)
        polygons = [[outer, hole]]
        self.assertTrue(copc.point_in_footprint(2, 2, polygons))
        self.assertFalse(copc.point_in_footprint(5, 5, polygons))
        arr = (np.array([1.] * 10 + [5.] * 10),
               np.array([1.] * 10 + [5.] * 10),
               np.array([100.] * 10 + [120.] * 10),
               np.array([2] * 10 + [1] * 10))
        result = copc.extract_derived_height("tile.laz", polygons, arr)
        self.assertTrue(result["lidarHeightStatus"].startswith("insufficient-roof-points:"))

    def test_multipart_buildings_keep_secondary_roof_geometry(self):
        first = self.ring(0, 0, 3, 3)
        second = self.ring(20, 20, 30, 30)
        polygons = [[first], [second]]
        arr = (np.array([25.] * 20), np.array([25.] * 20),
               np.array([100.] * 10 + [120.] * 10),
               np.array([2] * 10 + [1] * 10))
        result = copc.extract_derived_height("tile.laz", polygons, arr)
        self.assertEqual(result["lidarHeightStatus"], "OK")
        self.assertEqual(result["lidarHeightFt"], 20.0)

    def test_conversion_preserves_holes_and_all_parts(self):
        def make_poly(rings):
            return [[[x, y] for x, y in ring] for ring in rings]
        geo = {"type": "MultiPolygon", "coordinates": [
            make_poly([self.ring(0, 0, 10, 10), self.ring(4, 4, 6, 6)]),
            make_poly([self.ring(20, 20, 30, 30)]),
        ]}
        with patch.object(copc, "lonlat_to_spw", side_effect=lambda x, y: (x, y)):
            parts = copc.get_footprint_polygons_spw(geo)
            self.assertEqual([len(p) for p in parts], [2, 1])
            self.assertEqual(copc.get_footprint_ring_spw(geo), self.ring(0, 0, 10, 10))
        self.assertFalse(copc.point_in_footprint(5, 5, parts))
        self.assertTrue(copc.point_in_footprint(25, 25, parts))

    def test_invalid_footprint_coordinates_never_produce_height(self):
        for coord in ([200, 20], [float("nan"), 20], [0], [True, 20]):
            geom = {"type": "Polygon", "coordinates": [[
                [0, 0], [1, 0], coord, [0, 1], [0, 0]
            ]]}
            with self.subTest(coord=coord):
                with self.assertRaises(ValueError):
                    copc.get_footprint_polygons_spw(geom)


class CopcWorkflowTests(unittest.TestCase):
    grid = (537, 189)
    to_wgs84 = Transformer.from_crs(2968, 4326, always_xy=True)

    def footprint(self, oid, east, north, status="UNAVAILABLE"):
        ring = [(east, north), (east+20, north), (east+20, north+20),
                (east, north+20), (east, north)]
        return {"type": "Feature", "properties": {
            "igioObjectId": oid, "lidarHeightStatus": status,
        }, "geometry": {"type": "Polygon", "coordinates": [
            [self.to_wgs84.transform(x, y) for x, y in ring]
        ]}}

    def test_primary_cli_defers_crossing_window_even_if_one_tile_can_return_a_height(self):
        with TemporaryDirectory() as directory:
            work = Path(directory)
            source, tile_list, output = [work / filename for filename in
                                         ("input.geojson", "tiles.txt", "output.geojson")]
            features = [
                self.footprint(1, 2685100, 945100),
                self.footprint(2, 2689970, 949970),
                self.footprint(3, 2689970, 949970, "OK"),
            ]
            source.write_text(json.dumps({"features": features}))
            tile_url = copc.grid_url(self.grid)
            tile_list.write_text(tile_url + "\n")
            arrays = (
                np.repeat([2685110.0, 2689980.0], 20),
                np.repeat([945110.0, 949980.0], 20),
                np.tile(np.repeat([100.0, 120.0], 10), 2),
                np.tile(np.repeat([2, 1], 10), 2),
            )
            args = ["extract", "--geojson", str(source), "--tile-list", str(tile_list),
                    "--tile-dir", str(work), "--out", str(output),
                    "--tile-manifest", str(work / "manifest.json")]

            def stage_tile(url, path):
                self.assertEqual(url, tile_url)
                Path(path).touch()
                return "a" * 64

            with patch("sys.argv", args), patch.object(copc, "download_tile", side_effect=stage_tile), \
                    patch.object(copc, "verified_tile_bounds", return_value=(2685000, 945000, 2690000, 950000)), \
                    patch.object(copc, "load_tile_arrays", return_value=arrays) as read:
                self.assertEqual(copc.main(), 0)
                first = output.read_bytes()
                self.assertEqual(copc.main(), 0)
                self.assertEqual(output.read_bytes(), first)
                read.assert_called_once()
            rows = [feature["properties"] for feature in json.loads(first)["features"]]
            self.assertEqual(rows[0]["lidarHeightFt"], 20.0)
            self.assertEqual(rows[0]["lidarSource"], tile_url)
            self.assertEqual(rows[1]["lidarHeightStatus"], "adjacent-tile-window-required")
            self.assertNotIn("lidarHeightFt", rows[1])
            self.assertEqual(rows[2]["heightProvenance"], "OBSERVED")

    def test_source_header_requires_horizontal_and_vertical_crs_and_matching_grid(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "tile.las"
            for crs, message in [
                ("EPSG:2968", "NAVD88 US survey feet"),
                ("EPSG:2968+5703", "NAVD88 US survey feet"),
                ("EPSG:2966+6360", "Indiana West ftUS source CRS"),
                ("EPSG:2968+6360", None),
            ]:
                with self.subTest(crs=crs):
                    header = laspy.LasHeader(point_format=6, version="1.4")
                    header.add_crs(CRS.from_user_input(crs))
                    data = laspy.LasData(header)
                    data.x = [2685100]
                    data.y = [945100]
                    data.z = [375]
                    data.write(path)
                    if message:
                        with self.assertRaisesRegex(ValueError, message):
                            copc.verified_tile_bounds(path, self.grid)
                    else:
                        self.assertEqual(copc.verified_tile_bounds(path, self.grid),
                                         (2685100, 945100, 2685100, 945100))
                        with self.assertRaisesRegex(ValueError, "named tile"):
                            copc.verified_tile_bounds(path, (538, 189))


if __name__ == "__main__":
    unittest.main()
