"""Focused read API over the existing append-only event log and projections."""
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from .regional import (
    evidence_neighborhood, knowledge_neighborhood, stac_delivery_status,
)
from .settings import COLLECTION
from .store import connect

router = APIRouter(prefix="/v1/regional", tags=["regional"])


@router.get("/captures")
def captures(after: str = Query("", max_length=128),
             limit: int = Query(100, ge=1, le=250)):
    with connect() as conn:
        conn.execute("SET TRANSACTION READ ONLY")
        rows = conn.execute("""
            SELECT entity_id, event_seq, body, ST_AsGeoJSON(geom)::jsonb AS geometry
            FROM read_model.current_entity
            WHERE matrix='R' AND NOT retired AND entity_id>%s
            ORDER BY entity_id LIMIT %s
        """, (after, limit)).fetchall()
    return {"captures": rows, "next": rows[-1]["entity_id"] if rows else None}


@router.get("/assets")
def assets(after: str = Query("", max_length=128),
           limit: int = Query(100, ge=1, le=250)):
    with connect() as conn:
        conn.execute("SET TRANSACTION READ ONLY")
        rows = conn.execute("""
            SELECT entity_id, event_seq, body, ST_AsGeoJSON(geom)::jsonb AS geometry
            FROM read_model.current_entity
            WHERE matrix='I' AND NOT retired AND entity_id>%s
            ORDER BY entity_id LIMIT %s
        """, (after, limit)).fetchall()
    return {"assets": rows, "next": rows[-1]["entity_id"] if rows else None}


@router.get("/watersheds")
def watersheds(after: str = Query("", max_length=128),
               limit: int = Query(100, ge=1, le=250)):
    with connect() as conn:
        conn.execute("SET TRANSACTION READ ONLY")
        rows = conn.execute("""
            SELECT entity_id, event_seq, body, ST_AsGeoJSON(geom)::jsonb AS geometry
            FROM read_model.current_entity
            WHERE matrix='S' AND NOT retired AND entity_id LIKE 'watershed:%'
                  AND entity_id>%s
            ORDER BY entity_id LIMIT %s
        """, (after, limit)).fetchall()
    return {"watersheds": rows, "next": rows[-1]["entity_id"] if rows else None}


@router.get("/simulations")
def simulation_history(branch: str = Query("hec-ras-review", min_length=1, max_length=128),
                       limit: int = Query(100, ge=1, le=250)):
    """Simulation is scenario-derived history, never an observed live stage."""
    with connect() as conn:
        conn.execute("SET TRANSACTION READ ONLY")
        rows = conn.execute("""
            SELECT seq,body FROM twin.event
            WHERE matrix='M' AND timeline='scenario' AND branch=%s
            ORDER BY seq DESC LIMIT %s
        """, (branch, limit)).fetchall()
    return {"history": rows, "scope": "derived-scenario"}


@router.get("/calibrations")
def calibration_history(branch: str = Query("calibration-review", min_length=1, max_length=128),
                        limit: int = Query(100, ge=1, le=250)):
    with connect() as conn:
        conn.execute("SET TRANSACTION READ ONLY")
        rows = conn.execute("""
            SELECT seq,body FROM twin.event
            WHERE matrix='V' AND timeline='scenario' AND branch=%s
            ORDER BY seq DESC LIMIT %s
        """, (branch, limit)).fetchall()
    return {"history": rows, "scope": "withheld-until-reviewed"}


@router.get("/evidence/{event_id}")
def evidence_graph(event_id: UUID, limit: int = Query(100, ge=1, le=250)):
    with connect() as conn:
        conn.execute("SET TRANSACTION READ ONLY")
        rows = evidence_neighborhood(conn, str(event_id), limit=limit)
    return {"event_id": str(event_id), "links": rows, "graph": "accepted-evidence"}


@router.get("/knowledge/{entity_id}")
def knowledge_graph(entity_id: str, limit: int = Query(100, ge=1, le=250)):
    try:
        with connect() as conn:
            conn.execute("SET TRANSACTION READ ONLY")
            edges = knowledge_neighborhood(conn, entity_id, limit=limit)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return {"entity_id": entity_id, "edges": edges, "graph": "attributed-projection"}


@router.get("/stac/{event_id}")
def stac_receipt(event_id: UUID):
    try:
        with connect() as conn:
            conn.execute("SET TRANSACTION READ ONLY")
            result = stac_delivery_status(conn, str(event_id), COLLECTION)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    return result
