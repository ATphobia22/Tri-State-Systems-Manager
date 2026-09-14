"""HEC-RAS integration boundary.

Synthetic hydraulic values are deliberately prohibited. Real HEC-RAS output is
read from the model result artifact and analyzed by dedicated evidence modules.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from backend.api.v1.errors import HydraulicSolverError
from backend.engineering.hecras_hdf5 import discover_water_surface_datasets

try:
    from hecrasapi import HECRASController  # type: ignore
except ImportError:  # pragma: no cover
    HECRASController = None  # type: ignore[assignment]


def inspect_hecras_2d_output(project_hdf: str | Path) -> dict[str, Any]:
    """Inspect a real HEC-RAS HDF5 output without inventing hydraulic values."""
    refs = discover_water_surface_datasets(project_hdf)
    return {
        "engine": "hecras_hdf5",
        "project_hdf": str(Path(project_hdf).resolve()),
        "water_surface_datasets": [
            {"path": ref.path, "dataset_name": ref.dataset_name, "shape": list(ref.shape)}
            for ref in refs
        ],
        "authority_class": "MODEL_OUTPUT",
        "governance_status": "human_review_required",
        "is_simulation_demo": False,
    }


def run_hecras_2d(stage_ft: float, fill_volume_cy: float = 0.0, project_path: str | None = None) -> dict[str, Any]:
    """Reject the legacy synthetic API; callers must supply an actual HEC-RAS result artifact."""
    del stage_ft, fill_volume_cy
    if not project_path:
        raise HydraulicSolverError(
            "No HEC-RAS result artifact supplied. Synthetic hydraulic fallback has been removed; provide a real .hdf output.",
            engine="hecras_hdf5",
        )
    return inspect_hecras_2d_output(project_path)
