"""Fail-closed HEC-RAS HDF5 output discovery and time-series extraction."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

try:
    import h5py
except ImportError as exc:  # pragma: no cover
    h5py = None  # type: ignore[assignment]
    _H5PY_ERROR = exc
else:
    _H5PY_ERROR = None


@dataclass(frozen=True)
class HecRasDatasetRef:
    path: str
    dataset_name: str
    shape: tuple[int, ...]


def discover_water_surface_datasets(project_hdf: str | Path) -> tuple[HecRasDatasetRef, ...]:
    if h5py is None:
        raise RuntimeError("h5py is required for HEC-RAS HDF5 inspection") from _H5PY_ERROR
    path = Path(project_hdf)
    if not path.is_file():
        raise FileNotFoundError(path)
    results: list[HecRasDatasetRef] = []
    with h5py.File(path, "r") as handle:
        root = handle.get("Results/Unsteady/Output/Output Blocks/Base Output/Unsteady Time Series/2D Flow Areas")
        if root is None:
            raise ValueError("HEC-RAS 2D output root not found; verify this is an unsteady results HDF5")
        for area_name, area in root.items():
            if not hasattr(area, "get"):
                continue
            dataset = area.get("Water Surface")
            if dataset is not None and hasattr(dataset, "shape"):
                results.append(HecRasDatasetRef(
                    path=f"{root.name}/{area_name}/Water Surface",
                    dataset_name=f"{area_name}/Water Surface",
                    shape=tuple(int(v) for v in dataset.shape),
                ))
    if not results:
        raise ValueError("No 2D Water Surface datasets discovered in HEC-RAS output")
    return tuple(results)


def read_water_surface(project_hdf: str | Path, dataset_path: str, time_index: int = -1) -> list[float]:
    if h5py is None:
        raise RuntimeError("h5py is required for HEC-RAS HDF5 inspection") from _H5PY_ERROR
    with h5py.File(project_hdf, "r") as handle:
        dataset = handle.get(dataset_path)
        if dataset is None or len(dataset.shape) != 2:
            raise ValueError(f"Expected 2D HEC-RAS Water Surface dataset: {dataset_path}")
        if not -dataset.shape[0] <= time_index < dataset.shape[0]:
            raise IndexError("HEC-RAS time index outside available output range")
        values = dataset[time_index, :]
        return [float(value) for value in values]
