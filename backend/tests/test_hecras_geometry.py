from __future__ import annotations

import h5py
import numpy as np
import pytest

from backend.engineering.hecras_geometry import (
    discover_cell_center_datasets,
    read_cell_centers,
)


def _write_geometry(path):
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
        assert dataset.shape == (3, 2)


def test_discovers_flow_area_cell_centers(tmp_path):
    path = tmp_path / "geometry.hdf"
    _write_geometry(path)
    assert discover_cell_center_datasets(path) == (
        (
            "TestArea",
            "/Geometry/2D Flow Areas/TestArea/Cells Center Coordinate",
        ),
    )


def test_requires_explicit_source_crs(tmp_path):
    path = tmp_path / "geometry.hdf"
    _write_geometry(path)
    with pytest.raises(ValueError, match="source_crs is required"):
        read_cell_centers(path, "")


def test_transforms_projected_hecras_coordinates_to_epsg_2966(tmp_path):
    path = tmp_path / "geometry.hdf"
    _write_geometry(path)

    results = read_cell_centers(path, "EPSG:2966")
    assert len(results) == 2
    assert results[0].cell_id == 0
    assert results[0].easting_ft == pytest.approx(900000.0)
    assert results[0].northing_ft == pytest.approx(249999.9998984)
    assert results[1].cell_id == 1
