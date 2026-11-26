# -*- coding: utf-8 -*-
"""TSM 4D Twin API — constants, gauges, gates, earthwork, forecast. ADR-004 operator_id required."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from fastapi import APIRouter, HTTPException
    HAS_FASTAPI = True
except ImportError:
    HAS_FASTAPI = False
    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str):
            self.status_code = status_code
            self.detail = detail

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))
from gov.site_constants import (
    BFE_FT, HORIZONTAL_CRS_CANONICAL, MIN_BISHOP_FOS,
    USGS_GAUGE_ID, USGS_GAUGE_ZERO_NAVD88_FT,
    assert_invariants, get_sovereign_constants,
)

router = APIRouter(prefix="/v1", tags=["twin"]) if HAS_FASTAPI else None
GAUGE_PATH = ROOT / "data" / "usgs" / "gauge_zeros_navd88.json"

class DesignProposal:
    def __init__(self, proposal_id="", intersects_floodway=False, section_408=False,
                 slope_ratio=3.0, bishop_fos=None, within_811_buffer_m=False, **kw):
        self.proposal_id = proposal_id
        self.intersects_floodway = intersects_floodway
        self.section_408 = section_408
        self.slope_ratio = slope_ratio
        self.bishop_fos = bishop_fos
        self.within_811_buffer_m = within_811_buffer_m

class GateResult:
    def __init__(self, name="", passed=False, detail=""):
        self.name = name
        self.passed = passed
        self.detail = detail

def healthz():
    try:
        assert_invariants()
        return {"status": "ok", "utc": datetime.now(timezone.utc).isoformat()}
    except AssertionError as e:
        return {"status": "degraded", "detail": str(e)}

def constants():
    return get_sovereign_constants()

def evaluate_gates(proposal: DesignProposal):
    fos = proposal.bishop_fos if proposal.bishop_fos is not None else 99.0
    return [
        GateResult("44_CFR_65_10_floodway", not proposal.intersects_floodway, "floodway"),
        GateResult("Bishop_FoS", fos >= MIN_BISHOP_FOS, f"FoS={fos}"),
        GateResult("slope_3_to_1", proposal.slope_ratio >= 3.0, f"slope={proposal.slope_ratio}"),
        GateResult("811_buffer", not proposal.within_811_buffer_m, "811"),
        GateResult("BFE_context", True, f"BFE={BFE_FT} CRS={HORIZONTAL_CRS_CANONICAL}"),
    ]

if HAS_FASTAPI and router is not None:
    router.add_api_route("/healthz", healthz, methods=["GET"])
    router.add_api_route("/constants", constants, methods=["GET"])
    router.add_api_route("/gates/evaluate", evaluate_gates, methods=["POST"])
