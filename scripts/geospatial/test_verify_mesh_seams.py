"""Synthetic triangle-plane seam checks for +x/-x/+y/-y/+z/-z."""
from __future__ import annotations

import unittest

from scripts.geospatial.verify_mesh_seams import compare_interface, evaluate


def point(axis: int, tangent: int, normal: float, along: float) -> list[float]:
    xyz = [0.0, 0.0, 0.0]
    xyz[axis] = normal
    xyz[tangent] = along
    return xyz


def make_interface(direction: str, gap: float = 0.0, subdivide: bool = False) -> dict:
    axis = "xyz".index(direction[-1])
    tangent = (axis + 1) % 3
    a = point(axis, tangent, 0.0, 0.0)
    b = point(axis, tangent, 0.0, 1.0)
    lo = point(axis, tangent, -1.0, 0.5)
    hi = point(axis, tangent, 1.0, 0.5)
    left = {"vertices": [a, b, lo], "triangles": [[0, 1, 2]]}
    if subdivide:
        m = point(axis, tangent, 0.0, 0.5)
        h1, h2 = point(axis, tangent, 1.0, 0.25), point(axis, tangent, 1.0, 0.75)
        right = {"vertices": [a, m, b, h1, h2],
                 "triangles": [[0, 1, 3], [1, 2, 4]]}
    else:
        altered = point(axis, tangent, 0.0, 1.0 + gap)
        right = {"vertices": [a, altered, hi], "triangles": [[0, 1, 2]]}
    return {"id": "synthetic-" + direction, "direction": direction,
            "planeCoordinateM": 0.0, "left": left, "right": right}


class MeshSeamGeometryTests(unittest.TestCase):
    def test_all_six_signed_interfaces_can_be_verified(self):
        directions = ["+x", "-x", "+y", "-y", "+z", "-z"]
        r = evaluate({"toleranceM": 0.0001,
                      "interfaces": [make_interface(x) for x in directions]}, require_all_six=True)
        self.assertEqual(r["status"], "MEASURED_SEAM_SEGMENTS_MATCH_FOR_REVIEW")
        self.assertEqual(r["matchedInterfaces"], 6)
        self.assertEqual(sorted(directions), r["verifiedDirections"])
        self.assertFalse(r["approved"])
        self.assertIsNone(r["regulatoryDetermination"])

    def test_coarse_edge_vs_two_fine_edges_is_continuous(self):
        match = compare_interface(make_interface("+x", subdivide=True), 0.0001)
        self.assertEqual(match["status"], "MATCH")
        self.assertEqual(match["leftSegments"], 1)
        self.assertEqual(match["rightSegments"], 2)

    def test_missing_segment_is_not_silent(self):
        bad = make_interface("+x", gap=-0.2)
        r = compare_interface(bad, 0.0001)
        self.assertEqual(r["status"], "CRACK_OR_NONCOLLINEAR_SEGMENT")
        self.assertGreater(r["uncoveredLengthM"], 0.1)

    def test_all_six_is_required_when_requested(self):
        r = evaluate({"toleranceM": 0.0001, "interfaces": [make_interface("+x")]},
                     require_all_six=True)
        self.assertEqual(r["status"], "INCOMPLETE")
        self.assertTrue(any("six signed" in x for x in r["errors"]))

    def test_invalid_triangle_index_is_rejected(self):
        bad = make_interface("+z")
        bad["left"]["triangles"] = [[0, 1, 9]]
        r = evaluate({"toleranceM": 0.0001, "interfaces": [bad]})
        self.assertEqual(r["status"], "INCOMPLETE")
        self.assertTrue(any("invalid triangle" in x for x in r["errors"]))

    def test_nonfinite_vertex_is_rejected(self):
        bad = make_interface("-y")
        bad["left"]["vertices"][0][0] = float("nan")
        r = evaluate({"toleranceM": 0.0001, "interfaces": [bad]})
        self.assertEqual(r["status"], "INCOMPLETE")

    def test_empty_both_sides_not_fake_success(self):
        bad = make_interface("+y")
        bad["left"]["triangles"] = []
        bad["right"]["triangles"] = []
        r = evaluate({"toleranceM": 0.0001, "interfaces": [bad]})
        self.assertEqual(r["records"][0]["status"], "EMPTY_INTERFACE")
        self.assertEqual(r["status"], "INCOMPLETE")

    def test_one_sided_missing_triangle_reports_gap(self):
        bad = make_interface("-x")
        bad["right"]["triangles"] = []
        r = evaluate({"toleranceM": 0.0001, "interfaces": [bad]})
        self.assertEqual(r["records"][0]["status"], "ONE_SIDED_INTERFACE")
        self.assertEqual(r["status"], "INCOMPLETE")

    def test_duplicate_ids_and_tolerance_abuse_blocked(self):
        first = make_interface("+x")
        second = make_interface("-x")
        second["id"] = first["id"]
        r = evaluate({"toleranceM": 0.5, "interfaces": [first, second]})
        self.assertEqual(r["status"], "INCOMPLETE")
        self.assertTrue(any("toleranceM" in x for x in r["errors"]))
        self.assertTrue(any("unique" in x for x in r["errors"]))


if __name__ == "__main__":
    unittest.main()
