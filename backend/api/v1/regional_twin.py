"""Public read-only Posey regional twin API backed by persisted PostGIS evidence.

No internet retrieval or mutations occur in request handlers. Missing service,
missing approved snapshots, and missing independent measurements remain explicit.
"""
from __future__ import annotations

import json
import math
import os
from contextlib import closing
from typing import Any

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/geospatial/twin", tags=["regional-twin"])

PUBLIC_FIELDS = {
    "igio-buildings": frozenset(("county", "County", "lidaryear", "LidarYear")),
    "igio-parcels": frozenset(("parcel_id", "state_parcel_id", "county_fips",
                              "local_id", "prop_city", "prop_state", "prop_zip")),
    "igio-roads": frozenset(("st_name", "nguid", "effective", "dateupdate")),
    "indnr-flood": frozenset(("zone_subty", "fld_zone", "source_dnr", "dfirm_id")),
}
MAX_FEATURE_RESULTS = 500


def _connect():
    dsn = os.getenv("TSM_POSTGIS_DSN")
    if not dsn:
        raise HTTPException(status_code=503, detail={
            "code": "TWIN_DATABASE_UNCONFIGURED",
            "message": "No PostGIS connection is configured.",
        })
    try:
        import psycopg2
        return psycopg2.connect(dsn, connect_timeout=4)
    except Exception as exc:
        raise HTTPException(status_code=503, detail={
            "code": "TWIN_DATABASE_UNAVAILABLE",
        }) from exc


def _read(sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    try:
        from psycopg2.extras import RealDictCursor
        with closing(_connect()) as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(sql, params)
                return [dict(row) for row in cur.fetchall()]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail={
            "code": "TWIN_DATABASE_QUERY_UNAVAILABLE"
        }) from exc


def _bbox(raw: str) -> tuple[float, float, float, float]:
    try:
        vals = tuple(float(x) for x in raw.split(","))
    except (ValueError, AttributeError) as exc:
        raise HTTPException(422, detail={"code": "INVALID_BBOX"}) from exc
    if (len(vals) != 4 or not all(math.isfinite(v) for v in vals)
            or not (-180 <= vals[0] < vals[2] <= 180)
            or not (-90 <= vals[1] < vals[3] <= 90)
            or vals[2] - vals[0] > 3 or vals[3] - vals[1] > 3):
        raise HTTPException(422, detail={"code": "INVALID_OR_UNBOUNDED_BBOX"})
    return vals


def _properties(source_id: str, raw: dict | str | None) -> dict:
    if isinstance(raw, str):
        raw = json.loads(raw)
    if not isinstance(raw, dict):
        return {}
    fields = PUBLIC_FIELDS.get(source_id, frozenset())
    # Parcel owners, mailing addresses and other personal data are not public.
    return {name: raw[name] for name in fields if name in raw}


@router.get("/health")
def health() -> dict:
    rows = _read("SELECT postgis_version() AS postgis_version")
    return {"status": "CONNECTED", "database": "PostGIS",
            "postgisVersion": rows[0]["postgis_version"],
            "regulatoryDetermination": False}


@router.get("/sources")
def sources() -> dict:
    rows = _read("""
        SELECT s.source_id,s.authority,s.domain,s.endpoint,s.source_role,
               s.transport,s.evidence_class,s.source_note,
               COUNT(a.asset_id) FILTER (WHERE a.validation_status='PASS'
                   AND a.publication_status='APPROVED_FOR_VIEW') AS published_count
          FROM twin_geo.source s
          LEFT JOIN twin_geo.asset a ON a.source_id=s.source_id
         GROUP BY s.source_id ORDER BY s.domain,s.source_id
    """)
    return {"data": rows, "sourceRegistryIsObservation": False,
            "note": "A registered source has no data until snapshots pass review."}


@router.get("/assets")
def assets(source_id: str | None = Query(default=None, alias="sourceId"),
           limit: int = Query(50, ge=1, le=200),
           offset: int = Query(0, ge=0)) -> dict:
    rows = _read("""
        SELECT a.asset_id,a.source_id,a.asset_kind,a.source_version,
               a.retrieved_at,a.capture_start,a.capture_end,a.effective_date,
               a.horizontal_crs,a.vertical_datum,a.units,a.raw_sha256,
               a.attribution,a.license_note,s.evidence_class
          FROM twin_geo.asset a JOIN twin_geo.source s USING(source_id)
         WHERE a.validation_status='PASS'
           AND a.publication_status='APPROVED_FOR_VIEW'
           AND (%s::text IS NULL OR a.source_id=%s)
         ORDER BY a.retrieved_at DESC,a.asset_id LIMIT %s OFFSET %s
    """, (source_id, source_id, limit, offset))
    return {"data": rows, "pagination": {"limit": limit, "offset": offset,
                                       "returned": len(rows)},
            "regulatoryDetermination": False}


@router.get("/features/{asset_id}")
def features(asset_id: str, bbox: str = Query(..., description="minLon,minLat,maxLon,maxLat"),
             limit: int = Query(200, ge=1, le=MAX_FEATURE_RESULTS),
             offset: int = Query(0, ge=0)) -> dict:
    if not (3 <= len(asset_id) <= 128 and all(c.isascii() and
            (c.isalnum() or c in "_-") for c in asset_id)):
        raise HTTPException(422, detail={"code": "INVALID_ASSET_ID"})
    min_lon, min_lat, max_lon, max_lat = _bbox(bbox)
    rows = _read("""
      SELECT f.feature_id,ST_AsGeoJSON(f.geom) AS geom,f.properties,
             a.source_id,a.raw_sha256,a.capture_start,a.capture_end,
             s.evidence_class
        FROM twin_geo.feature f
        JOIN twin_geo.asset a USING(asset_id)
        JOIN twin_geo.source s USING(source_id)
       WHERE a.asset_id=%s
         AND a.validation_status='PASS'
         AND a.publication_status='APPROVED_FOR_VIEW'
         AND ST_Intersects(f.geom,ST_MakeEnvelope(%s,%s,%s,%s,4326))
       ORDER BY f.feature_id LIMIT %s OFFSET %s
    """, (asset_id, min_lon, min_lat, max_lon, max_lat, limit, offset))
    result = []
    for row in rows:
        geometry = row["geom"] if isinstance(row["geom"], dict) else json.loads(row["geom"])
        result.append({"type": "Feature", "id": row["feature_id"],
                       "geometry": geometry,
                       "properties": _properties(row["source_id"], row["properties"])})
    return {"type": "FeatureCollection", "features": result,
            "assetId": asset_id, "limit": limit, "offset": offset,
            "sourceIdentityPreserved": True, "regulatoryDetermination": False}


@router.get("/buildings/{asset_id}/{feature_id}/dimensions")
def building_dimensions(asset_id: str, feature_id: str) -> dict:
    if not (3 <= len(asset_id) <= 128 and 1 <= len(feature_id) <= 256):
        raise HTTPException(422, detail={"code": "INVALID_FEATURE_REFERENCE"})
    rows = _read("""
       SELECT m.measurement_id,m.method,m.measured_at,m.roof_height_m,
              m.ground_navd88_m,m.uncertainty_m,m.review_id,
              e.source_id AS evidence_source_id,e.raw_sha256 AS evidence_sha256
         FROM twin_geo.building_dimension m
         JOIN twin_geo.asset f ON f.asset_id=m.footprint_asset_id
         JOIN twin_geo.asset e ON e.asset_id=m.evidence_asset_id
        WHERE m.footprint_asset_id=%s AND m.footprint_feature_id=%s
          AND m.validation_status='PASS'
          AND f.validation_status='PASS'
          AND f.publication_status='APPROVED_FOR_VIEW'
          AND e.validation_status='PASS'
        ORDER BY m.measured_at DESC NULLS LAST LIMIT 25
    """, (asset_id, feature_id))
    if not rows:
        raise HTTPException(404, detail={"code": "INDEPENDENT_DIMENSION_EVIDENCE_UNAVAILABLE"})
    return {"assetId": asset_id, "featureId": feature_id,
            "measurements": rows,
            "warning": "Recorded independent measurements are not a boundary survey or certification."}


@router.get("/models")
def models(limit: int = Query(50, ge=1, le=200)) -> dict:
    rows = _read("""
      SELECT artifact_id,model_family,model_version,input_asset_ids,
             input_manifest_sha256,output_sha256,physical_baseline_id,
             evaluation,created_at,use_class
        FROM twin_geo.model_artifact
       WHERE validation_status='PASS'
         AND use_class='REVIEWED_DECISION_SUPPORT'
       ORDER BY created_at DESC LIMIT %s
    """, (limit,))
    return {"data": rows, "predictionIsObservation": False,
            "regulatoryDetermination": False}
