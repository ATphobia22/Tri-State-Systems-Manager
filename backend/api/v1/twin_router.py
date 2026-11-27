# -*- coding: utf-8 -*-
"""TSM 4D Twin API — constants, gauges, gates, earthwork, forecast. ADR-004 operator_id required."""
from __future__ import annotations

import json
import math
import sys
from dataclasses import dataclass
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
    MIN_BISHOP_FOS, assert_invariants, get_sovereign_constants,
)

router = APIRouter(prefix="/v1", tags=["twin"]) if HAS_FASTAPI else None
GAUGE_PATH = ROOT / "data" / "usgs" / "gauge_zeros_navd88.json"

@dataclass
class DesignProposal:
    proposal_id: str = ""
    intersects_floodway: Any = None
    section_408: Any = None
    slope_ratio: Any = None
    bishop_fos: Any = None
    within_811_buffer_m: Any = None

@dataclass
class GateResult:
    name: str = ""
    passed: bool = False
    detail: str = ""

def healthz():
    try:
        assert_invariants()
        return {"status": "ok", "utc": datetime.now(timezone.utc).isoformat()}
    except AssertionError as e:
        return {"status": "degraded", "detail": str(e)}

def constants():
    return get_sovereign_constants()

def evaluate_gates(proposal: DesignProposal):
    # Screening only. Missing evidence is never a passing condition.
    def finite_at_least(value, threshold):
        try:
            return type(value) in (int, float) and math.isfinite(value) and value >= threshold
        except OverflowError:
            return False
    return [
        GateResult("44_CFR_65_10_floodway", proposal.intersects_floodway is False, "screening only"),
        GateResult("Bishop_FoS", finite_at_least(proposal.bishop_fos, MIN_BISHOP_FOS), "screening only"),
        GateResult("slope_3_to_1", finite_at_least(proposal.slope_ratio, 3.0), "screening only"),
        GateResult("811_buffer", proposal.within_811_buffer_m is False, "screening only"),
        GateResult("BFE_context", False, "Project-specific source evidence and human review required"),
    ]

if HAS_FASTAPI and router is not None:
    router.add_api_route("/healthz", healthz, methods=["GET"])
    router.add_api_route("/constants", constants, methods=["GET"])
    router.add_api_route("/gates/evaluate", evaluate_gates, methods=["POST"])
