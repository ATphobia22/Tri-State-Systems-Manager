"""FastAPI route: evidence lock packet for console / LOMA critical path.

Fail-closed: returns SIMULATION_OR_SITE_CONSTANT labels; does not promote
human_authorized without reviewer fields. Aligns with ADR-004.
"""
from __future__ import annotations

import hashlib
import json
import time
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

router = APIRouter(prefix="/evidence", tags=["evidence-lock"])

DEFAULT_SITE: dict[str, Any] = {
    "location_address": "13101 BONEBANK RD, MOUNT VERNON, IN, 47620",
    "coordinates": {"latitude": 37.845887, "longitude": -88.005075},
    "community_number": "180209",
    "case_number": "26-05-2022A",
    "target_panel": "18129C0265C",
    "calculated_lag_navd88": 377.2,
    "effective_bfe_navd88": 375.0,
    "horizontal_crs": "EPSG:2966",
    "vertical_datum": "NAVD88",
}


class EvidenceLockRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lag_navd88: Optional[float] = Field(default=None, ge=300.0, le=450.0)
    bfe_navd88: Optional[float] = Field(default=None, ge=300.0, le=450.0)
    panel_number: Optional[str] = None
    human_authorized: bool = False
    reviewer_identity: Optional[str] = None
    review_reason: Optional[str] = None

    @field_validator("panel_number")
    @classmethod
    def panel_shape(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if len(v) < 5:
            raise ValueError("panel_number too short")
        return v


class EvidenceLockResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    artifact_schema: str
    timestamp_epoch: int
    immutable_hash: str
    freeboard_ft: float
    status: str
    human_authorized: bool
    payload: dict[str, Any]


@router.post("/lock-packet", response_model=EvidenceLockResponse)
def create_lock_packet(body: EvidenceLockRequest) -> EvidenceLockResponse:
    if body.human_authorized:
        if not body.reviewer_identity or not body.review_reason:
            raise HTTPException(
                status_code=400,
                detail="human_authorized requires reviewer_identity and review_reason",
            )

    site = dict(DEFAULT_SITE)
    if body.lag_navd88 is not None:
        site["calculated_lag_navd88"] = body.lag_navd88
    if body.bfe_navd88 is not None:
        site["effective_bfe_navd88"] = body.bfe_navd88
    if body.panel_number:
        site["target_panel"] = body.panel_number

    lag = float(site["calculated_lag_navd88"])
    bfe = float(site["effective_bfe_navd88"])
    freeboard = round(lag - bfe, 2)

    payload = {
        **site,
        "freeboard_lag_minus_bfe_ft": freeboard,
        "status_label": "SIMULATION_OR_SITE_CONSTANT — not a FEMA determination",
        "claim_controls": {
            "do_not_claim_loma_approved": True,
            "do_not_claim_loma_denied": True,
            "do_not_claim_historical_overcharge_without_policy_evidence": True,
            "requires_pe_or_surveyor_certification_for_mt1": True,
        },
        "human_authorized": body.human_authorized,
        "reviewer_identity": body.reviewer_identity,
        "review_reason": body.review_reason,
    }

    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    digest = hashlib.sha256(canonical).hexdigest()

    return EvidenceLockResponse(
        artifact_schema="tsm-evidence-artifact-schema-v1.0.0.json",
        timestamp_epoch=int(time.time()),
        immutable_hash=digest,
        freeboard_ft=freeboard,
        status="FAIL_CLOSED_VALIDATED",
        human_authorized=body.human_authorized,
        payload=payload,
    )
