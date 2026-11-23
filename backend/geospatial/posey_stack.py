"""Posey PostGIS read API: only operator-reviewed snapshots are public.

Run as: uvicorn backend.geospatial.posey_stack:app
The same router can be mounted by backend.app.main. No upstream fetching
on GET, no synthesized data and no unrestricted statewide feature dumps.
"""
from __future__ import annotations

import json
import math
import os
import re
from datetime import datetime
from typing import Any

from fastapi import APIRouter, FastAPI, HTTPException, Query

router = APIRouter(prefix="/api/geospatial/posey-stack", tags=["posey-geospatial"])
_SOURCE_ID = re.compile(r"^[a-z0-9-]{1,50}$")
# No owner names, mailing addresses or other unreviewed source attributes.
PUBLIC_FIELDS = {
    "parcel": {"objectid", "county", "state", "parcel_id"},
    "building": {"objectid", "county", "lidaryear", "sourceid"},
    "road": {"objectid", "st_name", "st_type", "county", "roadclass"},
    "floodplain": {"objectid", "fld_zone", "zone_subty", "dfirm_id", "sfha_tf"},
    "levee": {"objectid", "name", "leveeid"},
    "waterway": {"objectid", "gnis_name", "gnis_id", "fcode"},
    "history": {"record_id", "map_year"},
}


def parse_posey_bbox(raw: str) -> tuple[float, float, float, float]:
    """Small WGS84 regional window, not a statewide feature dump."""
    try:
        values = tuple(float(x) for x in raw.split(","))
    except (ValueError, TypeError) as exc:
        raise HTTPException(422, "bbox must be west,south,east,north EPSG:4326") from exc
    if len(values) != 4 or not all(math.isfinite(x) for x in values):
        raise HTTPException(422, "bbox must contain four finite numbers")
    west, south, east, north = values
    if not (-89 <= west < east <= -87 and 37 <= south < north <= 39):
        raise HTTPException(422, "bbox must be within the Posey regional envelope")
    if east - west > 1.0 or north - south > 1.0:
        raise HTTPException(422, "bbox exceeds the Posey query window")
    return west, south, east, north


def _dsn() -> str:
    value = os.environ.get("TSM_GEOSPATIAL_DSN", "")
    if not value:
        raise HTTPException(503, detail={"code": "GEOSPATIAL_DATABASE_NOT_CONFIGURED"})
    return value


def _connect():
    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError as exc:
        raise HTTPException(503, detail={"code": "PSYCOPG_UNAVAILABLE"}) from exc
    try:
        return psycopg.connect(_dsn(), row_factory=dict_row, connect_timeout=5)
    except psycopg.Error as exc:
        raise HTTPException(503, detail={"code": "GEOSPATIAL_DATABASE_UNAVAILABLE"}) from exc


def _public_properties(raw: Any, category: str) -> dict[str, Any]:
    if isinstance(raw, str):
        raw = json.loads(raw)
    if not isinstance(raw, dict):
        return {}
    names = PUBLIC_FIELDS.get(category, set())
    return {str(key): value for key, value in raw.items()
            if str(key).lower() in names and isinstance(value, (str, int, float, bool, type(None)))}


def _source_id(value: str) -> str:
    if not _SOURCE_ID.fullmatch(value):
        raise HTTPException(422, "invalid source identifier")
    return value


@router.get("/health")
def health() -> dict[str, str]:
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM geotwin.source LIMIT 1")
            cur.fetchone()
    return {"database": "CONNECTED", "publication": "REVIEW_GATED"}


@router.get("/sources")
def sources() -> dict[str, Any]:
    """Known source URLs plus actual reviewed-snapshot counts."""
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT s.source_id, s.category, s.agency, s.title, s.endpoint,
                       s.ingest_mode, s.authority_note, s.reuse_status,
                       COUNT(x.snapshot_id) FILTER (
                           WHERE x.review_status='APPROVED_FOR_VIEW')::integer AS published_snapshots,
                       COUNT(x.snapshot_id)::integer AS staged_and_reviewed_snapshots
                FROM geotwin.source s LEFT JOIN geotwin.snapshot x
                ON x.source_id = s.source_id
                GROUP BY s.source_id ORDER BY s.category,s.source_id
            """)
            records = cur.fetchall()
    return {"sources": records, "count": len(records),
            "warning": "Registered source != downloaded, licensed or validated dataset."}


@router.get("/layers")
def layers() -> dict[str, Any]:
    """Published snapshots only; staged and rejected data are absent."""
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT DISTINCT ON (p.source_id)
                       p.snapshot_id::text AS snapshot_id, p.source_id,
                       s.title, s.category, s.agency, p.source_url,
                       p.sha256, p.retrieved_at, p.acquisition_date,
                       p.effective_date, p.source_crs, p.vertical_datum,
                       p.evidence_class, p.attribution, p.license_note,
                       p.feature_count, p.review_status
                FROM geotwin.snapshot p JOIN geotwin.source s USING(source_id)
                WHERE p.review_status='APPROVED_FOR_VIEW'
                ORDER BY p.source_id, p.retrieved_at DESC, p.created_at DESC
            """)
            rows = cur.fetchall()
    return {"layers": rows, "count": len(rows),
            "regulatory_determination": False}


@router.get("/layers/{source_id}/features")
def features(source_id: str, bbox: str = Query(..., max_length=110),
             limit: int = Query(100, ge=1, le=250),
             after: str = Query("", max_length=256),
             as_of: datetime | None = Query(None)) -> dict[str, Any]:
    """as_of selects source-retrieval time, NOT flood or historical validity."""
    sid = _source_id(source_id)
    west, south, east, north = parse_posey_bbox(bbox)
    if as_of is not None and (as_of.tzinfo is None or as_of.utcoffset() is None):
        raise HTTPException(422, "as_of must include an explicit timezone")
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.snapshot_id::text AS snapshot_id, p.sha256, p.retrieved_at,
                       p.acquisition_date, p.effective_date, p.source_crs,
                       p.vertical_datum, p.evidence_class, p.source_url,
                       s.category, s.agency
                FROM geotwin.snapshot p JOIN geotwin.source s USING(source_id)
                WHERE p.source_id=%s AND p.review_status='APPROVED_FOR_VIEW'
                  AND (%s::timestamptz IS NULL OR p.retrieved_at<=%s::timestamptz)
                ORDER BY p.retrieved_at DESC,p.created_at DESC LIMIT 1
            """, (sid, as_of, as_of))
            snapshot = cur.fetchone()
            if snapshot is None:
                raise HTTPException(404, detail={"code": "NO_REVIEWED_SNAPSHOT",
                                                  "source_id": sid})
            cur.execute("""
                SELECT feature_id, ST_AsGeoJSON(geom) AS geometry, properties
                FROM geotwin.feature
                WHERE snapshot_id=%s::uuid AND feature_id>%s
                  AND geom && ST_MakeEnvelope(%s,%s,%s,%s,4326)
                  AND ST_Intersects(geom,ST_MakeEnvelope(%s,%s,%s,%s,4326))
                ORDER BY feature_id LIMIT %s
            """, (snapshot["snapshot_id"], after, west, south, east, north,
                  limit + 1))
            rows = cur.fetchall()
    result = []
    for row in rows[:limit]:
        result.append({
            "type": "Feature", "id": row["feature_id"],
            "geometry": json.loads(row["geometry"]),
            "properties": _public_properties(row["properties"], snapshot["category"]),
        })
    return {
        "type": "FeatureCollection", "features": result,
        "next_after": rows[limit - 1]["feature_id"] if len(rows) > limit else None,
        "source": snapshot, "crs": "EPSG:4326",
        "time_meaning": "source retrieval time; not valid-time replay",
        "engineering_validation": "not implied by publication",
        "regulatory_determination": False,
    }


app = FastAPI(title="TSM Posey Geospatial API", version="1.0.0")
app.include_router(router)
