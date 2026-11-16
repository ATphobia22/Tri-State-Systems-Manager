import unittest

from shapely.geometry import box
from shapely.strtree import STRtree

from tools.geospatial_exchange.posey_loma_screen import overlaps, polygon


class PoseyLomaScreenTests(unittest.TestCase):
    def test_positive_area_includes_containment_but_excludes_boundary_touch(self):
        footprint = box(0, 0, 2, 2)
        index = STRtree([box(2, 0, 3, 2), box(1, 1, 3, 3), box(0.5, 0.5, 1, 1)])
        self.assertEqual(set(overlaps(index, footprint)), {1, 2})

    def test_repair_extracts_area_and_excludes_degenerate_geometry(self):
        def feature(coords):
            return {"geometry": {"type": "Polygon", "coordinates": [coords]}}

        crossed = feature([(0, 0), (2, 2), (2, 0), (0, 2), (0, 0)])
        flat = feature([(0, 0), (1, 0), (2, 0), (0, 0)])
        self.assertIsNone(polygon(crossed))
        self.assertEqual(sum(part.area for part in polygon(crossed, repair=True)), 2)
        self.assertEqual(polygon(flat, repair=True), [])
        self.assertEqual(polygon({"geometry": None}, repair=True), [])
