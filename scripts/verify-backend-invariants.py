#!/usr/bin/env python3
"""Backend invariants and fail-closed engineering-boundary smoke test."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.gov.site_constants import HORIZONTAL_CRS, MASTER_SEAL, assert_invariants
from backend.governance.archimedes_engine import ArchimedesEngine
from backend.api.v1.hecras_solver import run_hecras_2d
from backend.api.v1.schemas import (
    CompensatoryStorageRequest,
    GeodeticFrame,
    HydraulicRequest,
    SiteElevations,
)


def main() -> int:
    assert_invariants()
    assert HORIZONTAL_CRS == "EPSG:2966"
    assert len(MASTER_SEAL) == 64
    archimedes = ArchimedesEngine()
    screening = archimedes.evaluate_jurisdiction_compliance(
        "IN", 374.0, 375.0, floodway_delta_ft=0.10, authoritative_model_id="VERIFY-ARCHIMEDES"
    )
    assert screening["screening_status"] == "SCREENED_NO_TRIGGER"
    assert screening["regulatory_determination"] is None
    assert screening["human_review_required"] is True

    # Explicit test fixture only; these values are not application/site defaults.
    SiteElevations(
        bfe_ft=375.0,
        lag_ft=377.2,
        ffe_ft=382.5,
        berm_crest_ft=379.8,
        vertical_datum="NAVD88",
    )
    GeodeticFrame(vertical_datum="NAVD88")
    HydraulicRequest(stage_ft=373.5, fill_volume_cy=0.0)
    CompensatoryStorageRequest(
        fill_volume_cy=1000.0,
        actual_cut_cy=1200.0,
        required_cut_cy=1000.0,
        rule_id="TEST-SOURCE-BOUND-RULE",
        jurisdiction="IN",
    )

    try:
        GeodeticFrame(horizontal_crs="EPSG:2967", vertical_datum="NAVD88")
        return 1
    except Exception:
        pass

    try:
        CompensatoryStorageRequest(
            fill_volume_cy=1000.0,
            actual_cut_cy=900.0,
            required_cut_cy=1000.0,
            rule_id="TEST-SOURCE-BOUND-RULE",
            jurisdiction="IN",
        )
        return 1
    except Exception:
        pass

    try:
        SiteElevations(
            bfe_ft=375.0,
            lag_ft=377.2,
            ffe_ft=382.5,
            berm_crest_ft=379.8,
            vertical_datum="UNVERIFIED",
        )
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
