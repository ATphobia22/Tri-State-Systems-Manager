#!/usr/bin/env python3
"""Regression: a Transvoxel receipt must not invent Indiana West EPSG:2968."""
from __future__ import annotations

import hashlib
import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import numpy as np
import rasterio
from rasterio.transform import from_origin

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/geospatial/mount_vernon_dem_transvoxel_gate.py"
sys.path.insert(0, str(SCRIPT.parent))
SPEC = importlib.util.spec_from_file_location("mount_vernon_dem_transvoxel_gate", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def make_raster(path: Path, *, crs: str | None) -> str:
    with rasterio.open(
        path, "w", driver="GTiff", height=64, width=64,
        count=1, dtype="float32", crs=crs,
        transform=from_origin(300000, 4200000, 1, 1),
    ) as dataset:
        dataset.write(np.full((64, 64), 120.0, dtype="float32"), 1)
    return hashlib.sha256(path.read_bytes()).hexdigest()


class SourceCrsReceiptTests(unittest.TestCase):
    def test_crs_is_read_from_real_projected_raster_not_a_hard_coded_value(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "source.tif"
            make_raster(path, crs="EPSG:32616")
            self.assertEqual(MODULE.source_horizontal_crs(path), "EPSG:32616")

    def test_missing_raster_crs_is_not_silently_assigned(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "source.tif"
            make_raster(path, crs=None)
            with self.assertRaisesRegex(ValueError, "horizontal CRS"):
                MODULE.source_horizontal_crs(path)

    def test_geographic_degree_raster_is_not_reported_as_metric(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "source.tif"
            make_raster(path, crs="EPSG:4326")
            with self.assertRaisesRegex(ValueError, "projected"):
                MODULE.source_horizontal_crs(path)

    def test_source_crs_is_written_to_full_seam_receipt(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "source.tif"
            digest = make_raster(path, crs="EPSG:32616")
            sample = np.full((64, 64), 120.0, dtype=np.float64)

            def fake_mesh(_sdf, _origin, _axis, _extent):
                return ([(0., 0., 0.), (1., 0., 0.), (0., 1., 0.)],
                        [(0, 1, 2)], {"case": "synthetic fixture"})

            with mock.patch.dict(os.environ, {"TSM_DEM_VERTICAL_UNIT": "us-ft"}), (
                mock.patch.object(MODULE, "load_dem_window", return_value=(sample, 1.0))
            ), mock.patch.object(MODULE, "mesh_transition_cell", side_effect=fake_mesh):
                receipt = MODULE.run(path, digest, window_x=0, window_y=0, window_size=64)
            self.assertEqual(receipt["crs"], "EPSG:32616")
            self.assertEqual(receipt["verticalDatum"], "PENDING_EVIDENCE")
            self.assertFalse(receipt["engineeringApproved"])


if __name__ == "__main__":
    unittest.main()
