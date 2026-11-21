"""Read-only snapshot, catch-up, and Cesium GeoJSON endpoints."""
import asyncio
from datetime import datetime, timezone
import os

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from prometheus_client import make_asgi_app

from .contracts import JSON_SCHEMA
from .observability import setup
from .store import changes, connect, snapshot

app = FastAPI(title="TSM Living Twin", version="1")
setup("living-twin-api")
FastAPIInstrumentor.instrument_app(app, excluded_urls="health,metrics")
app.mount("/metrics", make_asgi_app())
origins = os.getenv("CESIUM_ORIGINS", "").split(",") if os.getenv("CESIUM_ORIGINS") else []
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET"])
MATRICES = set(JSON_SCHEMA["properties"]["matrix"]["enum"])
ID_PATTERN = JSON_SCHEMA["properties"]["entity_id"]["pattern"]
MAX_CURSOR = 9223372036854775807


@app.get("/health")
def health():
    with connect() as conn:
        conn.execute("SELECT 1 FROM twin.event LIMIT 1")
    return {"status": "ok"}


@app.get("/v1/changes")
def change_batch(after: int = Query(0, ge=0, le=MAX_CURSOR),
                 limit: int = Query(100, ge=1, le=250)):
    rows = changes(after, limit)
    return {"cursor": rows[-1]["seq"] if rows else after, "changes": rows}


@app.get("/v1/snapshot")
def read_snapshot(
    valid_at: datetime | None = None,
    known_at: datetime | None = None,
    timeline: str = "observed",
    branch: str = Query("main", pattern=ID_PATTERN),
    matrix: str | None = None,
    bbox: str | None = Query(None, max_length=128),
    after_matrix: str = "",
    after_id: str = Query("", max_length=128),
    watermark: int | None = Query(None, ge=0, le=MAX_CURSOR),
    limit: int = Query(100, ge=1, le=250),
):
    now = datetime.now(timezone.utc)
    valid_at, known_at = valid_at or now, known_at or now
    if valid_at.utcoffset() is None or known_at.utcoffset() is None:
        raise HTTPException(422, "Timestamps require an explicit offset")
    if timeline not in ("observed", "forecast", "scenario") or ((timeline == "observed") != (branch == "main")):
        raise HTTPException(422, "Invalid timeline and branch combination")
    if (matrix and matrix not in MATRICES) or (after_matrix and after_matrix not in MATRICES):
        raise HTTPException(422, "Unknown matrix")
    box = None
    if bbox:
        try:
            west, south, east, north = map(float, bbox.split(","))
            if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
                raise ValueError
        except ValueError as error:
            raise HTTPException(422, "Expected west,south,east,north in EPSG:4326") from error
        box = (west, south, east, north)
    rows, mark = snapshot(valid_at, known_at, timeline, branch, matrix, box,
                          (after_matrix, after_id), limit + 1, watermark)
    page = rows[:limit]
    next_key = None
    if len(rows) > limit:
        last = page[-1]["event"]
        next_key = {"after_matrix": last["matrix"], "after_id": last["entity_id"]}
    return {"valid_at": valid_at, "known_at": known_at, "watermark": mark,
            "next": next_key, "entries": page}


@app.get("/v1/cesium")
def cesium_snapshot(
    bbox: str = Query(..., max_length=128),
    matrix: str | None = None,
    watermark: int | None = Query(None, ge=0, le=MAX_CURSOR),
    valid_at: datetime | None = None,
    known_at: datetime | None = None,
    after_matrix: str = "",
    after_id: str = Query("", max_length=128),
):
    page = read_snapshot(valid_at=valid_at, known_at=known_at, matrix=matrix,
                         bbox=bbox, watermark=watermark, limit=250, branch="main",
                         after_matrix=after_matrix, after_id=after_id)
    return {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "id": f"{row['event']['matrix']}:{row['event']['entity_id']}",
            "geometry": row["geometry"],
            "properties": {
                "matrix": row["event"]["matrix"], "entity_id": row["event"]["entity_id"],
                "event_id": row["event"]["event_id"], "source": row["event"]["source"],
                "valid_from": row["event"]["valid_from"],
            },
        } for row in page["entries"]],
        **{key: page[key] for key in ("watermark", "next", "valid_at", "known_at")},
    }


@app.websocket("/v1/live")
async def live(socket: WebSocket, after: int = 0):
    if after < 0 or after > MAX_CURSOR:
        await socket.close(code=1008)
        return
    origin = socket.headers.get("origin")
    if origin and origin not in origins and origin.split("://", 1)[-1] != socket.headers.get("host"):
        await socket.close(code=1008)
        return
    await socket.accept()
    try:
        while True:
            batch = await run_in_threadpool(change_batch, after, 100)
            if batch["changes"]:
                await asyncio.wait_for(socket.send_json(batch), timeout=10)
                after = batch["cursor"]
                continue
            try:
                message = await asyncio.wait_for(socket.receive(), timeout=1)
                if message["type"] == "websocket.disconnect":
                    return
            except asyncio.TimeoutError:
                continue
    except (WebSocketDisconnect, TimeoutError):
        return
