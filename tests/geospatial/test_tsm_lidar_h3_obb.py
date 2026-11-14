"""Regression tests for the LAS/LAZ -> H3 v4 -> ECEF OBB manifest script.

Covers the gate that shipped broken (pyproj has no ``is_geographic_3d``),
the refusal paths, and the happy path on a small synthetic LAS. The happy
path and the compound-CRS behaviour need laspy/h3 and are skipped when
those packages are absent, so the gate tests still run on a bare checkout.
The synthetic LAS is clearly labeled test data — it exercises code paths,
not real survey data.
"""
import hashlib
import json
import math
import tempfile
import unittest
from pathlib import Path

import numpy as np

from scripts.geospatial.tsm_lidar_h3_obb import (
    is_geographic_3d,
    require_3d_source_crs,
    run,
)
from scripts.geospatial.tsm_math_engine import TSMMathEngine as E

try:
    import h3
    import laspy
except ImportError:  # pragma: no cover - exercised only with the deps installed
    h3 = None
    laspy = None

HAS_LAS_DEPS = h3 is not None and laspy is not None

# Bonebank anchor (Point Township, Posey County, IN) — same fixture anchor
# as tests/geospatial/test_tsm_math_engine.py.
ANCHOR_LAT = 37.84589
ANCHOR_LON = -88.00510


def _synthetic_las(path: Path, n: int = 60) -> list:
    """Write a small synthetic LAS around the anchor in EPSG:4979
    (lon, lat, ellipsoidal height). Returns the (lat, lon, h) points."""
    rng = np.random.default_rng(20261113)
    lats = ANCHOR_LAT + rng.uniform(-0.0005, 0.0005, n)
    lons = ANCHOR_LON + rng.uniform(-0.0005, 0.0005, n)
    heights = rng.uniform(115.0, 124.0, n)
    header = laspy.LasHeader(point_format=3, version="1.4")
    header.scales = (1e-7, 1e-7, 1e-3)
    header.offsets = (-88.0, 37.8, 100.0)
    las = laspy.LasData(header)
    las.x = lons
    las.y = lats
    las.z = heights
    las.write(path)
    return list(zip(lats, lons, heights))


class TestSourceCrsGate(unittest.TestCase):
    def test_is_geographic_3d_helper(self):
        from pyproj import CRS

        self.assertTrue(is_geographic_3d(CRS.from_epsg(4979)))
        self.assertFalse(is_geographic_3d(CRS.from_epsg(4326)))

    def test_gate_accepts_3d_crs(self):
        # Geographic 3D, geocentric, and compound CRSs all encode a vertical datum.
        for code in ("EPSG:4979", "EPSG:4978", "EPSG:2966+5703"):
            crs = require_3d_source_crs(code)
            self.assertIsNotNone(crs)

    def test_gate_rejects_2d_crs(self):
        # 2D geographic and 2D projected CRSs carry no vertical datum.
        for code in ("EPSG:4326", "EPSG:3857", "EPSG:26916"):
            with self.assertRaises(ValueError):
                require_3d_source_crs(code)

    def test_gate_rejects_2d_crs_via_run(self):
        # The gate fires before laspy is imported, so no laspy is needed here.
        with tempfile.TemporaryDirectory() as tmp:
            probe = Path(tmp) / "probe.las"
            probe.write_bytes(b"")
            with self.assertRaises(ValueError):
                run(probe, "EPSG:4326", 9, Path(tmp) / "out.json")


class TestRunRefusals(unittest.TestCase):
    def test_missing_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(FileNotFoundError):
                run(Path(tmp) / "nope.las", "EPSG:4979", 9, Path(tmp) / "out.json")

    def test_bad_resolution(self):
        with tempfile.TemporaryDirectory() as tmp:
            probe = Path(tmp) / "probe.las"
            probe.write_bytes(b"")
            with self.assertRaises(ValueError):
                run(probe, "EPSG:4979", 16, Path(tmp) / "out.json")

    def test_nonpositive_max_points(self):
        with tempfile.TemporaryDirectory() as tmp:
            probe = Path(tmp) / "probe.las"
            probe.write_bytes(b"")
            with self.assertRaises(ValueError):
                run(probe, "EPSG:4979", 9, Path(tmp) / "out.json", max_points=0)


@unittest.skipUnless(HAS_LAS_DEPS, "laspy/h3 required for the happy path")
class TestRunHappyPath(unittest.TestCase):
    def test_epsg4979_end_to_end(self):
        from pyproj import Transformer

        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            las_path = tmp / "synth_epsg4979.las"
            _synthetic_las(las_path)
            out_path = tmp / "out.json"
            result = run(las_path, "EPSG:4979", 9, out_path)

            # Ground truth is the points as stored in the file (LAS scales /
            # offsets quantize them), i.e. exactly what the script read.
            with laspy.open(las_path) as handle:
                chunk = next(handle.chunk_iterator(200_000))
            points = list(
                zip(
                    np.asarray(chunk.y),
                    np.asarray(chunk.x),
                    np.asarray(chunk.z),
                )
            )

            self.assertEqual(result["total_points"], len(points))
            self.assertGreaterEqual(result["total_h3_cells"], 1)
            self.assertEqual(result["h3_resolution"], 9)
            self.assertEqual(result["artifact_type"], "TSM_H3_ECEF_OBB_QA")
            self.assertEqual(
                result["source_sha256"],
                hashlib.sha256(las_path.read_bytes()).hexdigest(),
            )
            self.assertTrue(out_path.is_file())
            stored = json.loads(out_path.read_text(encoding="utf-8"))
            self.assertEqual(stored["total_points"], len(points))
            self.assertEqual(
                sum(b["point_count"] for b in stored["h3_bins"].values()),
                len(points),
            )

            # Independent cross-check: every point's H3 cell at res 9, and
            # every bin's OBB center / box against the math engine.
            transform = Transformer.from_crs("EPSG:4979", "EPSG:4979", always_xy=True)
            by_cell = {}
            for lat, lon, height in points:
                _, _, h = transform.transform(lon, lat, height)
                cell = h3.latlng_to_cell(lat, lon, 9)
                by_cell.setdefault(cell, []).append(
                    E.geodetic_to_ecef(lat, lon, h)
                )
            self.assertEqual(set(by_cell), set(stored["h3_bins"]))
            for cell, xyz in by_cell.items():
                expected = E.compute_oriented_bounding_box(np.asarray(xyz))
                got = stored["h3_bins"][cell]
                self.assertEqual(got["point_count"], len(xyz))
                self.assertEqual(len(got["ogc_3d_tiles_box"]), 12)
                np.testing.assert_allclose(
                    got["center_ecef"], expected["center"], atol=1e-6
                )
                np.testing.assert_allclose(
                    got["half_extents_m"], expected["half_extents"], atol=1e-6
                )
                np.testing.assert_allclose(
                    got["ogc_3d_tiles_box"],
                    expected["ogc_3d_tiles_box"],
                    atol=1e-6,
                )

    def test_compound_crs_grid_behaviour(self):
        """EPSG:2966+5703 (Indiana West + NAVD88) needs PROJ grids that are
        absent on this VM and on stock CI runners: the script must refuse
        with a grid error rather than silently ballparking. If grids ARE
        present, a successful run with valid output is equally acceptable."""
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            las_path = tmp / "synth_compound.las"
            _synthetic_las(las_path)
            try:
                result = run(las_path, "EPSG:2966+5703", 9, tmp / "out.json")
            except Exception as exc:  # noqa: BLE001 - behaviour differs by grids
                self.assertIn("Grid", str(exc))
            else:
                self.assertEqual(result["total_points"], 60)
                self.assertGreaterEqual(result["total_h3_cells"], 1)


if __name__ == "__main__":
    unittest.main()
