"""State API queries with a bounded, revision-keyed optional Redis cache."""
import json
import os

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from redis import Redis, RedisError

from twin.read import query

REDIS_URL = os.getenv("TWIN_REDIS_URL")
CACHE = Redis.from_url(REDIS_URL, socket_connect_timeout=0.15, socket_timeout=0.15,
                       retry_on_timeout=False) if REDIS_URL else None


def parse_bounds(raw):
    if raw is None:
        return None
    try:
        west, south, east, north = map(float, raw.split(","))
        if -180 <= west < east <= 180 and -90 <= south < north <= 90:
            return west, south, east, north
    except ValueError:
        pass
    raise HTTPException(422, "Expected west,south,east,north in EPSG:4326")


def page(matrix, after, limit, *, bbox=None, view_version=None):
    with query.consistent() as conn:
        mark = query.checkpoint(conn)
        version = f"{mark['instance_id']}:{mark['generation']}:{mark['last_seq']}"
        if view_version is not None and view_version != version:
            raise HTTPException(409, "Projection changed. Restart pagination.")
        key = "tsm:state:" + json.dumps([version, matrix, after, limit, bbox], separators=(",", ":"))
        if CACHE is not None:
            try:
                hit = CACHE.get(key)
                if hit is not None:
                    return json.loads(hit)
            except (RedisError, ValueError):
                pass
        rows = query.current(conn, matrix, after, limit + 1, bbox)
        result = {
            "watermark": mark["last_seq"], "view_version": version,
            "entries": rows[:limit], "next_after": rows[limit - 1]["entity_id"] if len(rows) > limit else None,
        }
        if matrix == "H" and bbox is None:
            gauges = query.gauges(conn, limit + 1)
            result["gauges"] = gauges[:limit]
            result["gauges_truncated"] = len(gauges) > limit
    if CACHE is not None:
        try:
            CACHE.set(key, json.dumps(jsonable_encoder(result)), ex=15)
        except RedisError:
            pass
    return result
