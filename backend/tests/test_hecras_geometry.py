from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import h5py
import numpy as np

from backend.engineering.hecras_geometry import (
    discover_cell_center_datasets,
    read_cell_centers,
)


class HecRasGeometryTests(unittest.TestCase):
    def _write_geometry(self, path: Path) -> None:
        with h5py.File(path, "w") as handle:
            dataset = handle.create_dataset(
                "Geometry/2D Flow Areas/TestArea/Cells Center Coordinate",
                data=np.array(
                    [
                        [900000.0, 249999.9998984],
                        [900100.0, 250099.9998984],
                        [np.nan, np.nan],
                    ],
                    dtype=float,
                ),
            )
            self.assertEqual(dataset.shape, (3, 2))

    def test_discovers_flow_area_cell_centers(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "geometry.hdf"
            self._write_geometry(path)
            self.assertEqual(
                discover_cell_center_datasets(path),
                (
                    (
                        "TestArea",
                        "/Geometry/2D Flow Areas/TestArea/Cells Center Coordinate",
                    ),
                ),
            )

    def test_requires_explicit_source_crs(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "geometry.hdf"
            self._write_geometry(path)
            with self.assertRaisesRegex(ValueError, "source_crs is required"):
                read_cell_centers(path, "")

    def test_transforms_projected_coordinates_to_epsg_2966(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "geometry.hdf"
            self._write_geometry(path)
            results = read_cell_centers(path, "EPSG:2966")

            self.assertEqual(len(results), 2)
            self.assertEqual(results[0].cell_id, 0)
            self.assertAlmostEqual(results[0].easting_ft, 900000.0)
            self.assertAlmostEqual(results[0].northing_ft, 249999.9998984)
            self.assertEqual(results[1].cell_id, 1)


if __name__ == "__main__":
    unittest.main()
