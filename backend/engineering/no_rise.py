"""Compare paired HEC-RAS Water Surface outputs under identical model conditions."""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import math
from pathlib import Path

from .hecras_hdf5 import discover_water_surface_datasets, read_water_surface


@dataclass(frozen=True)
class NoRiseResult:
    max_rise_ft: float
    max_drop_ft: float
    mean_delta_ft: float
    compared_values: int
    compliant: bool
    criterion_ft: float
    base_model_hash: str
    proposed_model_hash: str


def _file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def compare_water_surface(base_hdf: str | Path, proposed_hdf: str | Path, *, criterion_ft: float = 0.01, time_index: int = -1, dataset_path: str | None = None) -> NoRiseResult:
    if criterion_ft < 0:
        raise ValueError("criterion_ft cannot be negative")
    base = Path(base_hdf)
    proposed = Path(proposed_hdf)
    if dataset_path is None:
        base_refs = discover_water_surface_datasets(base)
        proposed_refs = discover_water_surface_datasets(proposed)
        base_names = {ref.dataset_name for ref in base_refs}
        common = next((ref.dataset_name for ref in proposed_refs if ref.dataset_name in base_names), None)
        if common is None:
            raise ValueError("no common 2D Flow Area Water Surface dataset exists between base and proposed models")
        dataset_path = f"Results/Unsteady/Output/Output Blocks/Base Output/Unsteady Time Series/2D Flow Areas/{common}"
        if not dataset_path.endswith("/Water Surface"):
            dataset_path += "/Water Surface"
    base_values = read_water_surface(base, dataset_path, time_index)
    proposed_values = read_water_surface(proposed, dataset_path, time_index)
    if len(base_values) != len(proposed_values):
        raise ValueError("base and proposed Water Surface arrays have different cell/node counts")
    deltas = [p - b for b, p in zip(base_values, proposed_values) if math.isfinite(b) and math.isfinite(p)]
    if not deltas:
        raise ValueError("no finite paired Water Surface values were available")
    return NoRiseResult(
        max(deltas), min(deltas), sum(deltas) / len(deltas), len(deltas), max(deltas) <= criterion_ft,
        criterion_ft, _file_hash(base), _file_hash(proposed),
    )


def result_manifest(result: NoRiseResult) -> str:
    return json.dumps(result.__dict__, sort_keys=True, separators=(",", ":"))
