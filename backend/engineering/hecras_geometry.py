"""Fail-closed HEC-RAS 2D cell-center geometry extraction.

HEC-RAS project geometry is stored in the model's projected coordinate system.
The source CRS must therefore be supplied explicitly; this module never assumes
WGS84 for raw HDF5 coordinates.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import h5py
import numpy as np
from pyproj import CRS, Transformer


@dataclass(frozen=True)
class HecRasCellCenter:
    flow_area: str
    cell_id: int
    source_x: float
    source_y: float
    easting_ft: float
    northing_ft: float
    source_crs: str
    target_crs: str = "EPSG:2966"


def discover_cell_center_datasets(project_hdf: str | Path) -> tuple[tuple[str, str], ...]:
    """Discover 2D Flow Area cell-center datasets without hardcoding an area name."""
    path = Path(project_hdf)
    if not path.is_file():
        raise FileNotFoundError(path)

    results: list[tuple[str, str]] = []
    with h5py.File(path, "r") as handle:
        root = handle.get("Geometry/2D Flow Areas")
        if root is None:
            raise ValueError("HEC-RAS geometry root not found")

        for area_name, area in root.items():
            if not hasattr(area, "get"):
                continue
            dataset = area.get("Cells Center Coordinate")
            if dataset is None or not hasattr(dataset, "shape"):
                continue
            if len(dataset.shape) != 2 or dataset.shape[1] != 2:
                raise ValueError(
                    f"Invalid cell-center coordinate shape for {area_name}: {dataset.shape}"
                )
            results.append(
                (str(area_name), f"{root.name}/{area_name}/Cells Center Coordinate")
            )

    if not results:
        raise ValueError("No HEC-RAS 2D cell-center coordinate datasets discovered")
    return tuple(results)


def read_cell_centers(
    project_hdf: str | Path,
    source_crs: str,
    target_crs: str = "EPSG:2966",
    flow_area: str | None = None,
) -> tuple[HecRasCellCenter, ...]:
    """Read and transform HEC-RAS cell centers to the target projected CRS.

    source_crs is mandatory because HEC-RAS coordinates are project-specific.
    """
    if not str(source_crs).strip():
        raise ValueError(
            "source_crs is required; raw HEC-RAS coordinates cannot be assumed WGS84"
        )

    source = CRS.from_user_input(source_crs)
    target = CRS.from_user_input(target_crs)
    transformer = Transformer.from_crs(source, target, always_xy=True)

    datasets = discover_cell_center_datasets(project_hdf)
    if flow_area is not None:
        datasets = tuple(item for item in datasets if item[0] == flow_area)
        if not datasets:
            raise KeyError(f"HEC-RAS flow area not found: {flow_area}")

    results: list[HecRasCellCenter] = []
    with h5py.File(project_hdf, "r") as handle:
        for area_name, dataset_path in datasets:
            coordinates = np.asarray(handle[dataset_path][:], dtype=float)
            for cell_id, (source_x, source_y) in enumerate(coordinates):
                if not np.isfinite(source_x) or not np.isfinite(source_y):
                    continue

                easting, northing = transformer.transform(
                    float(source_x), float(source_y)
                )
                if not np.isfinite(easting) or not np.isfinite(northing):
                    raise ValueError(
                        f"CRS transformation failed for {area_name} cell {cell_id}"
                    )

                results.append(
                    HecRasCellCenter(
                        flow_area=area_name,
                        cell_id=cell_id,
                        source_x=float(source_x),
                        source_y=float(source_y),
                        easting_ft=float(easting),
                        northing_ft=float(northing),
                        source_crs=source.to_string(),
                        target_crs=target.to_string(),
                    )
                )
    return tuple(results)
