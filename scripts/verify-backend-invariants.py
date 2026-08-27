#!/usr/bin/env python3
"""PTDT v35 — quick backend invariant + HEC-RAS solver smoke test."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.gov.site_constants import assert_invariants, HORIZONTAL_CRS, BFE_FT, LAG_FT, MASTER_SEAL
from backend.api.v1.hecras_solver import run_hecras_2d

def main() -> int:
    assert_invariants()
    assert HORIZONTAL_CRS == "EPSG:2966"
    assert BFE_FT == 375.0 and LAG_FT == 377.2
    assert len(MASTER_SEAL) == 64

    result = run_hecras_2d(stage_ft=373.5, fill_volume_cy=0.0)
    assert result["crs"] == "EPSG:2966"
    assert result["bfe_ft"] == 375.0
    assert result["no_rise_compliant"] is True
    assert result["engine"] in ("pure_python_saint_venant", "hecrasapi_2d")

    print("[verify-backend-invariants] PASS")
    print(f"  CRS={result['crs']}  BFE={result['bfe_ft']}  LAG={result['lag_ft']}")
    print(f"  engine={result['engine']}  fost={result['fost']}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
