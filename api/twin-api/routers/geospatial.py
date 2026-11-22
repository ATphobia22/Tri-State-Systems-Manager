"""Read-only, indexed spatial evidence links for public Atlas and offline staging."""
from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from twin.geospatial_links import LAYER_KINDS
from twin.read.query import checkpoint, consistent
from ..services.current import parse_bounds

router = APIRouter()


@router.get("/twin/geospatial")
def geospatial_layers(
    bbox: str = Query(..., max_length=128),
    kind: Literal["terrain", "building", "floodplain", "parcel", "3d_tiles"] | None = None,
    after: str = Query("", max_length=128),
    limit: int = Query(100, ge=1, le=250),
    view_version: str | None = Query(None, max_length=90),
):
    """Geographic bbox in WGS84; no implicit CRS transform or network fetch."""
    west, south, east, north = parse_bounds(bbox)
    with consistent() as conn:
        mark = checkpoint(conn)
        version = f"{mark['instance_id']}:{mark['generation']}:{mark['last_seq']}"
        if view_version is not None and view_version != version:
            raise HTTPException(409, "Projection changed. Restart pagination.")
        rows = conn.execute("""
            SELECT entity_id, event_seq AS seq, body AS event,
                   ST_AsGeoJSON(geom)::jsonb AS geometry
            FROM read_model.current_entity
            WHERE matrix='E' AND NOT retired AND geom IS NOT NULL
                AND body->'state'->>'geo_layer_kind' = ANY(%s::text[])
                AND (%s::text IS NULL OR body->'state'->>'geo_layer_kind'=%s)
                AND entity_id>%s
                AND geom && ST_MakeEnvelope(%s,%s,%s,%s,4326)
                AND ST_Intersects(geom,ST_MakeEnvelope(%s,%s,%s,%s,4326))
            ORDER BY entity_id LIMIT %s
        """, (sorted(LAYER_KINDS), kind, kind, after, west, south, east, north,
              west, south, east, north, limit + 1)).fetchall()
    return {
        "watermark": mark["last_seq"], "view_version": version,
        "entries": rows[:limit],
        "next_after": rows[limit-1]["entity_id"] if len(rows) > limit else None,
        "crs": "EPSG:4326",
        "disclaimer": "Evidence and spatial links only; source and datum review states apply.",
    }
