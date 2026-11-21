import asyncio
from datetime import datetime, timezone
import hmac
import os
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool

from twin.contracts import JSON_SCHEMA
from twin.projections import replay
from twin.read.query import checkpoint, consistent, projected_changes
from twin.store import snapshot

from ..services.current import page, parse_bounds

router = APIRouter()
MATRICES = set(JSON_SCHEMA["properties"]["matrix"]["enum"])
MODES = {"observed", "forecast", "scenario"}
CESIUM = {"buildings": "B", "hydrology": "H", "infrastructure": "I"}
MAX_SEQ = 9223372036854775807


def require_admin(authorization: str | None = Header(None)):
    token = os.getenv("TWIN_REBUILD_TOKEN", "")
    if not token:
        raise HTTPException(503, "Rebuild administration is disabled")
    if not hmac.compare_digest((authorization or "").encode(), f"Bearer {token}".encode()):
        raise HTTPException(401, "Invalid rebuild credential", headers={"WWW-Authenticate": "Bearer"})


@router.get("/health")
def health():
    with consistent() as conn:
        return {"status": "ok", "watermark": checkpoint(conn)["last_seq"]}


@router.get("/twin/current")
def current_matrix(matrix: str,
                   after: str = Query("", max_length=128), limit: int = Query(100, ge=1, le=250),
                   view_version: str | None = Query(None, max_length=90)):
    if matrix not in MATRICES:
        raise HTTPException(422, "Unknown matrix")
    return page(matrix, after, limit, view_version=view_version)


@router.get("/twin/time/{valid_at}")
def time_travel(
    valid_at: datetime,
    known_at: datetime | None = None,
    timeline: str = "observed",
    branch: str = Query("main", pattern=JSON_SCHEMA["properties"]["branch"]["pattern"]),
    matrix: str | None = None,
    bbox: str | None = Query(None, max_length=128),
    after_matrix: str = "",
    after_id: str = Query("", max_length=128),
    watermark: int | None = Query(None, ge=0, le=MAX_SEQ),
    limit: int = Query(100, ge=1, le=250),
):
    known_at = known_at or datetime.now(timezone.utc)
    if valid_at.utcoffset() is None or known_at.utcoffset() is None:
        raise HTTPException(422, "Timestamps require an explicit offset")
    if timeline not in MODES or (timeline == "observed") != (branch == "main"):
        raise HTTPException(422, "Invalid timeline and branch")
    if (matrix and matrix not in MATRICES) or (after_matrix and after_matrix not in MATRICES):
        raise HTTPException(422, "Unknown matrix")
    rows, mark = snapshot(valid_at, known_at, timeline, branch, matrix, parse_bounds(bbox),
                          (after_matrix, after_id), limit + 1, watermark)
    next_page = None
    if len(rows) > limit:
        last = rows[limit - 1]["event"]
        next_page = {"after_matrix": last["matrix"], "after_id": last["entity_id"]}
    return {"valid_at": valid_at, "known_at": known_at, "watermark": mark,
            "entries": rows[:limit], "next": next_page}


@router.post("/rebuild/{target}", status_code=202, dependencies=[Depends(require_admin)])
def submit_rebuild(target: Literal["projections", "stac"],
                   idempotency_key: UUID = Header(..., alias="Idempotency-Key")):
    try:
        return replay.submit(idempotency_key, target)
    except replay.ReplayConflict as error:
        raise HTTPException(409, str(error)) from error


@router.get("/rebuild/jobs/{job_id}", dependencies=[Depends(require_admin)])
def rebuild_status(job_id: UUID):
    row = replay.status(job_id)
    if row is None:
        raise HTTPException(404, "Unknown rebuild job")
    return row


@router.get("/cesium/live/{layer}")
def cesium(layer: Literal["buildings", "hydrology", "infrastructure"],
           bbox: str = Query(..., max_length=128), after: str = Query("", max_length=128),
           limit: int = Query(100, ge=1, le=250),
           view_version: str | None = Query(None, max_length=90)):
    data = page(CESIUM[layer], after, limit, bbox=parse_bounds(bbox), view_version=view_version)
    return {"type": "FeatureCollection", "watermark": data["watermark"],
            "view_version": data["view_version"], "next_after": data["next_after"],
            "features": [{
                "type": "Feature", "id": row["entity_id"], "geometry": row["geometry"],
                "properties": {"event_id": row["event"]["event_id"], "source": row["event"]["source"]},
            } for row in data["entries"]]}


@router.websocket("/twin/live")
async def live(socket: WebSocket, after: int = 0):
    origin = socket.headers.get("origin")
    allowed = os.getenv("CESIUM_ORIGINS", "").split(",")
    if not 0 <= after <= MAX_SEQ or (
        origin and origin not in allowed and origin.split("://", 1)[-1] != socket.headers.get("host")
    ):
        await socket.close(code=1008)
        return
    await socket.accept()
    try:
        while True:
            batch = await run_in_threadpool(projected_changes, after, 100)
            if batch["changes"]:
                await asyncio.wait_for(socket.send_json(batch), timeout=10)
                after = batch["cursor"]
                continue
            try:
                notice = await asyncio.wait_for(socket.receive(), timeout=1)
                if notice["type"] == "websocket.disconnect":
                    return
            except TimeoutError:
                continue
    except (WebSocketDisconnect, TimeoutError):
        return
