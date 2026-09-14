#!/usr/bin/env python3
"""Backend invariants and fail-closed engineering-boundary smoke test."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.gov.site_constants import assert_invariants, HORIZONTAL_CRS, BFE_FT, LAG_FT, MASTER_SEAL
from backend.api.v1.hecras_solver import run_hecras_2d
from backend.api.v1.schemas import SiteElevations, GeodeticFrame, HydraulicRequest, CompensatoryStorageRequest


def main() -> int:
    assert_invariants()
    assert HORIZONTAL_CRS == "EPSG:2966"
    assert BFE_FT == 375.0 and LAG_FT == 377.2
    assert len(MASTER_SEAL) == 64
    SiteElevations()
    GeodeticFrame()
    HydraulicRequest(stage_ft=373.5, fill_volume_cy=0.0)
    CompensatoryStorageRequest(fill_volume_cy=1000.0, actual_cut_cy=1200.0)

    try:
        GeodeticFrame(horizontal_crs="EPSG:2967")
        return 1
    except Exception:
        pass
    try:
        CompensatoryStorageRequest(fill_volume_cy=1000.0, actual_cut_cy=1100.0)
        return 1
    except Exception:
        pass
    try:
        run_hecras_2d(stage_ft=373.5, fill_volume_cy=0.0)
        print("FAIL: synthetic HEC-RAS fallback was accepted")
        return 1
    except Exception:
        pass
    print("[verify-backend-invariants] PASS — geodetic invariants and HEC-RAS fail-closed boundary verified")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
