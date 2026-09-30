"""Read-only HEC-RAS HDF5 result inspection.

The reader intentionally exposes discovery and metadata rather than assuming
private HEC-RAS HDF5 paths are stable across releases.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

import h5py


@dataclass(frozen=True)
class DatasetInfo:
    path: str
    shape: tuple[int, ...]
    dtype: str


class Hdf5ResultReader:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        if not self.path.is_file():
            raise FileNotFoundError(self.path)
        if self.path.suffix.lower() not in {".hdf", ".h5"}:
            raise ValueError("HEC-RAS result must be an HDF5 .hdf or .h5 artifact")

    def datasets(self) -> Iterator[DatasetInfo]:
        with h5py.File(self.path, "r") as handle:
            def visit(name: str, obj: h5py.Dataset | h5py.Group) -> None:
                if isinstance(obj, h5py.Dataset):
                    yield_target.append(DatasetInfo(name, tuple(obj.shape), str(obj.dtype)))

            yield_target: list[DatasetInfo] = []
            handle.visititems(visit)
            yield from yield_target

    def has_group(self, path: str) -> bool:
        with h5py.File(self.path, "r") as handle:
            return path in handle and isinstance(handle[path], h5py.Group)
