#!/usr/bin/env python3
"""PTDT v35 — backend invariant + Pydantic V2 + HEC-RAS + error-path smoke test."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.gov.site_constants import assert_invariants, HORIZONTAL_CRS, BFE_FT, LAG_FT, MASTER_SEAL
from backend.api.v1.hecras_solver import run_hecras_2d
from backend.api.v1.schemas import SiteElevations, GeodeticFrame, HydraulicRequest, CompensatoryStorageRequest
from backend.api.v1.errors import GeodeticInvariantError, HydraulicSolverError


def main() -> int:
    assert_invariants()
    assert HORIZONTAL_CRS == "EPSG:2966"
    assert BFE_FT == 375.0 and LAG_FT == 377.2

    SiteElevations()
    GeodeticFrame()
    HydraulicRequest(stage_ft=373.5, fill_volume_cy=0.0)
    CompensatoryStorageRequest(fill_volume_cy=1000.0, actual_cut_cy=1200.0)

    try:
        GeodeticFrame(horizontal_crs="EPSG:2967")
        print("FAIL: accepted EPSG:2967")
        return 1
    except Exception:
        pass

    try:
        CompensatoryStorageRequest(fill_volume_cy=1000.0, actual_cut_cy=1100.0)
        print("FAIL: accepted No-Rise violation")
        return 1
    except Exception:
        pass

    result = run_hecras_2d(stage_ft=373.5, fill_volume_cy=0.0)
    assert result["crs"] == "EPSG:2966"
    assert result["no_rise_compliant"] is True

    print("[verify-backend-invariants] PASS")
    print(f"  CRS={result['crs']} BFE={result['bfe_ft']} engine={result['engine']}")
    print("  pydantic V2 + error types OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
