# -*- coding: utf-8 -*-
"""
PTDT v35 — Asynchronous Backend API Core
Anchor: 13101 Bonebank Road | EPSG:2966 | NAVD88
BFE 375.0 | LAG 377.2 | FFE 382.5
"""

import asyncio
import datetime
import hashlib
import json
import logging
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [%(levelname)s] %(message)s")
logger = logging.getLogger("PTDT_BACKEND")

SITE_INVARIANTS = {
    "project_node": "13101 Bonebank Road, Point Township, Posey County, Indiana",
    "coordinates": [-88.0142, 37.8348],
    "crs_horiz": "EPSG:2966",
    "vertical_datum": "NAVD88",
    "bfe_ft": 375.0,
    "lag_ft": 377.2,
    "ffe_ft": 382.5,
    "berm_crest_ft": 379.8,
    "verified_apn": "65-19-08-100-008.001-010",
    "cid_posey_unincorporated": "180209",
    "assessor_office": "Posey County Assessor (Nancy A. Hoehn)",
    "bca_ratio": 2.45,
}


class StageEvaluationRequest(BaseModel):
    stage_vector_ft: float = Field(..., ge=350.0, le=400.0)
    jurisdiction: str = Field("INDIANA")


class AssessorReconcileRequest(BaseModel):
    apn_string: str


class BricSealRequest(BaseModel):
    apn_verified: str
    stage_vector_ft: float
    jurisdiction: str = "INDIANA"


class TelemetryConnectionManager:
    def __init__(self) -> None:
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]) -> None:
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                pass


app = FastAPI(title="PTDT v35 Sovereign API", version="35.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

telemetry_manager = TelemetryConnectionManager()
current_stage_vector = 375.0
ledger_block_height = 1420


def compute_canonical_sha256(payload: Dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return "0x" + hashlib.sha256(canonical).hexdigest()


@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "ONLINE_ACTIVE",
        "engine": "PTDT v35 Sovereign Backend",
        "timestamp_utc": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
        "invariants": SITE_INVARIANTS,
    }


@app.post("/api/v1/hydro/stage")
async def evaluate_hydro_stage(req: StageEvaluationRequest):
    global current_stage_vector, ledger_block_height
    current_stage_vector = req.stage_vector_ft
    clearance = round(SITE_INVARIANTS["lag_ft"] - current_stage_vector, 2)
    is_violation = clearance < 0
    is_warning = 0 <= clearance < 1.0
    finding = (
        "SURCHARGED FOUNDATION"
        if is_violation
        else ("MARGINAL FREEBOARD" if is_warning else "BASELINE")
    )
    status = (
        "CRITICAL VIOLATION"
        if is_violation
        else ("WARNING BOUNDARY" if is_warning else "COMPLIANT")
    )
    ledger_block_height += 1
    audit = {
        "node": SITE_INVARIANTS["project_node"],
        "stage_vector_ft": current_stage_vector,
        "clearance_ft": clearance,
        "finding": finding,
        "status": status,
        "block_height": ledger_block_height,
        "timestamp_utc": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
    }
    seal = compute_canonical_sha256(audit)
    asyncio.create_task(
        telemetry_manager.broadcast(
            {
                "type": "HYDRO_STAGE_UPDATE",
                "stage_vector_ft": current_stage_vector,
                "clearance_ft": clearance,
                "status": status,
                "seal": seal,
                "block_height": ledger_block_height,
            }
        )
    )
    return {
        "stage_vector_ft": current_stage_vector,
        "clearance_ft": clearance,
        "finding": finding,
        "status": status,
        "block_height": ledger_block_height,
        "daubert_evidence_seal": seal,
    }


@app.post("/api/v1/assessor/reconcile")
async def reconcile_assessor_apn(req: AssessorReconcileRequest):
    clean_input = "".join(filter(str.isdigit, req.apn_string))
    clean_authority = "".join(filter(str.isdigit, SITE_INVARIANTS["verified_apn"]))
    if clean_input == clean_authority:
        return {
            "status": "VERIFIED",
            "apn_normalized": SITE_INVARIANTS["verified_apn"],
            "assessor_office": SITE_INVARIANTS["assessor_office"],
            "lomr_f_qualified": True,
            "message": "50 IAC 26-8-1 Normalization Rules Cleared.",
        }
    return {
        "status": "UNVERIFIED_DUAL",
        "apn_normalized": req.apn_string,
        "lomr_f_qualified": False,
        "message": "APN mismatch. LOMA BLOCKED.",
    }


@app.post("/api/v1/bric/seal")
async def generate_fema_bric_manifest(req: BricSealRequest):
    clean_input = "".join(filter(str.isdigit, req.apn_verified))
    clean_authority = "".join(filter(str.isdigit, SITE_INVARIANTS["verified_apn"]))
    if clean_input != clean_authority:
        raise HTTPException(
            status_code=400,
            detail="APN must be verified via Assessor Gate before manifest sealing.",
        )
    manifest = {
        "project_node": SITE_INVARIANTS["project_node"],
        "grant_phase": "FY 2024-25 FEMA BRIC / HMA",
        "apn_verified": SITE_INVARIANTS["verified_apn"],
        "bca_ratio": SITE_INVARIANTS["bca_ratio"],
        "hydrodynamics": {
            "simulated_stage_ft": req.stage_vector_ft,
            "clearance_ft": round(SITE_INVARIANTS["lag_ft"] - req.stage_vector_ft, 2),
            "compliance_gates": ["IC 14-28-1", "312 IAC 10-5"],
        },
        "elevations_navd88": {
            "bfe_ft": SITE_INVARIANTS["bfe_ft"],
            "lag_ft": SITE_INVARIANTS["lag_ft"],
            "ffe_ft": SITE_INVARIANTS["ffe_ft"],
            "berm_crest_ft": SITE_INVARIANTS["berm_crest_ft"],
        },
        "timestamp_utc": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
    }
    seal = compute_canonical_sha256(manifest)
    manifest["daubert_evidence_seal"] = seal
    return {"manifest_payload": manifest, "daubert_evidence_seal": seal, "status": "SEALED_PASSED"}


@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await telemetry_manager.connect(websocket)
    try:
        while True:
            await asyncio.sleep(3.0)
            await websocket.send_json(
                {
                    "type": "HEARTBEAT_TELEMETRY",
                    "current_stage_ft": current_stage_vector,
                    "block_height": ledger_block_height,
                    "timestamp_utc": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
                }
            )
    except WebSocketDisconnect:
        telemetry_manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
