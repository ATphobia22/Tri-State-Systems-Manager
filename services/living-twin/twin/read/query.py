"""Read side transactions shared by the Twin State API."""
from contextlib import contextmanager

from ..store import connect


@contextmanager
def consistent():
    with connect() as conn:
        conn.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        yield conn


def checkpoint(conn):
    return conn.execute("""
        SELECT instance_id,last_seq,generation,recorded_at
        FROM read_model.checkpoint WHERE projection='current'
    """).fetchone()


def current(conn, matrix, after_id, limit, bbox=None):
    west, south, east, north = bbox if bbox else (-180, -90, 180, 90)
    return conn.execute("""
        SELECT entity_id,event_seq AS seq, body AS event, ST_AsGeoJSON(geom)::jsonb AS geometry
        FROM read_model.current_entity
        WHERE matrix=%s AND entity_id>%s AND NOT retired
            AND (%s OR ST_Intersects(geom,ST_MakeEnvelope(%s,%s,%s,%s,4326)))
        ORDER BY entity_id LIMIT %s
    """, (matrix, after_id, bbox is None, west, south, east, north, limit)).fetchall()


def gauges(conn, limit):
    return conn.execute("""
        SELECT entity_id,event_seq AS seq,body AS event,
               ST_AsGeoJSON(geom)::jsonb AS geometry
        FROM read_model.current_gauge_observation
        ORDER BY sensor_id,parameter,series LIMIT %s
    """, (limit,)).fetchall()


def projected_changes(after, limit):
    with consistent() as conn:
        mark = checkpoint(conn)["last_seq"]
        rows = conn.execute("""
            SELECT seq,body AS event FROM twin.event
            WHERE seq>%s AND seq<=%s ORDER BY seq LIMIT %s
        """, (after, mark, limit)).fetchall()
    return {"watermark": mark, "cursor": rows[-1]["seq"] if rows else after, "changes": rows}
