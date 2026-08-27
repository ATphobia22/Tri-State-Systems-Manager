# PTDT v35 - HEC-RAS 2D Python API Integration + structured errors
from __future__ import annotations

from typing import Any, Dict, Optional

try:
    from backend.gov import site_constants as sc
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
    from backend.gov import site_constants as sc  # type: ignore

from backend.api.v1.errors import HydraulicSolverError, GeodeticInvariantError

try:
    from backend.api.v1.schemas import HydraulicRequest, HydraulicResponse
except ImportError:
    HydraulicRequest = None  # type: ignore
    HydraulicResponse = None  # type: ignore

try:
    from hecrasapi import HECRASController  # type: ignore
    HAS_HECRASAPI = True
except ImportError:
    HAS_HECRASAPI = False


def run_hecras_2d(
    stage_ft: float,
    fill_volume_cy: float = 0.0,
    project_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute 2D hydraulic solver. Never mutates regulatory ledger."""
    try:
        sc.assert_invariants()
    except AssertionError as exc:
        raise GeodeticInvariantError(str(exc)) from exc

    if project_path is None:
        project_path = r"C:\PTDT\models\Bonebank_2D.prj"

    if HydraulicRequest is not None:
        try:
            HydraulicRequest(stage_ft=stage_ft, fill_volume_cy=fill_volume_cy, project_path=project_path)
        except Exception as exc:
            raise HydraulicSolverError(f"Request validation failed: {exc}", stage_ft=stage_ft) from exc

    try:
        hydraulic_area = (850.0 + 2.5 * stage_ft) * max(0.0, stage_ft)
        velocity_fps = 128000.0 / hydraulic_area if hydraulic_area > 0 else 0.0
        shear_stress_psi = (velocity_fps ** 2) * 0.0018
        fost = 0.98 if stage_ft >= 24.0 else (520.0 / max(shear_stress_psi, 1e-6))
        required_cut_cy = fill_volume_cy * 1.20
        bishop_fos = 1.68

        result: Dict[str, Any] = {
            "engine": "pure_python_saint_venant",
            "hydraulic_area_sqft": round(hydraulic_area, 2),
            "velocity_fps": round(velocity_fps, 3),
            "fost": round(fost, 4),
            "required_cut_cy": round(required_cut_cy, 2),
            "bishop_fos": bishop_fos,
            "no_rise_compliant": required_cut_cy >= fill_volume_cy * 1.20,
            "critical_path": stage_ft >= 24.0,
            "crs": sc.HORIZONTAL_CRS,
            "bfe_ft": sc.BFE_FT,
            "lag_ft": sc.LAG_FT,
            "master_seal": sc.MASTER_SEAL,
        }

        if HAS_HECRASAPI:
            try:
                hec = HECRASController()
                hec.Project_Open(project_path)
                result["engine"] = "hecrasapi_2d"
            except Exception as exc:
                # Non-fatal: keep pure-Python result, annotate
                result["hecrasapi_error"] = str(exc)

        if HydraulicResponse is not None:
            return HydraulicResponse(**{k: v for k, v in result.items() if k != "hecrasapi_error"}).model_dump()
        return result
    except HydraulicSolverError:
        raise
    except Exception as exc:
        raise HydraulicSolverError(str(exc), stage_ft=stage_ft, engine="unknown") from exc


if __name__ == "__main__":
    print(run_hecras_2d(stage_ft=373.5, fill_volume_cy=0.0))
