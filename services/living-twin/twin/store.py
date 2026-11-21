"""Single-transaction event, lineage, audit, and outbox writes."""
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .contracts import InvalidEvent, canonical, fingerprint, validate
from .settings import DATABASE


def connect(database=DATABASE):
    return psycopg.connect(database, row_factory=dict_row, connect_timeout=4,
                           options="-c statement_timeout=12000 -c lock_timeout=5000")


def apply(event: dict, database=DATABASE) -> tuple[int, bool]:
    validate(event)
    digest = fingerprint(event)
    try:
        with connect(database) as conn:
            # This serialization point makes committed feed cursors safe across concurrent writers.
            conn.execute("SELECT pg_advisory_xact_lock(946322,1)")
            existing = conn.execute(
                "SELECT seq,digest FROM twin.event WHERE event_id=%s", (event["event_id"],)
            ).fetchone()
            if existing:
                if existing["digest"] != digest:
                    raise InvalidEvent("Event identity reused with a different payload")
                return existing["seq"], False
            if event["matrix"] in ("D", "V") and event["operation"] == "upsert":
                required = "reviewed_by" if event["matrix"] == "D" else "validates"
                if not any(link["relationship"] == required for link in event["evidence"]):
                    raise InvalidEvent(f"{event['matrix']} requires {required} evidence")
            geom = canonical(event["geometry"]) if event["geometry"] is not None else None
            seq = conn.execute("""
                INSERT INTO twin.event(event_id,digest,matrix,entity_id,timeline,branch,
                                       valid_from,operation,geom,body)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,ST_GeomFromGeoJSON(%s::text),%s)
                RETURNING seq
            """, (event["event_id"], digest, event["matrix"], event["entity_id"],
                  event["timeline"], event["branch"], event["valid_from"],
                  event["operation"], geom, Jsonb(event))).fetchone()["seq"]
            for link in event["evidence"]:
                conn.execute("""
                    INSERT INTO twin.evidence_link VALUES (%s,%s,%s)
                """, (seq, link["event_id"], link["relationship"]))
            conn.execute("INSERT INTO twin.outbox(event_seq,destination) VALUES (%s,'kafka')", (seq,))
            if event["asset"]:
                conn.execute("INSERT INTO twin.outbox(event_seq,destination) VALUES (%s,'pgstac')", (seq,))
            return seq, True
    except psycopg.IntegrityError as error:
        raise InvalidEvent("State geometry, timeline, or evidence constraint failed") from error
    except psycopg.Error as error:
        if error.sqlstate in ("22P02", "22023") or (
            error.sqlstate == "XX000" and geom is not None and "geojson" in str(error).lower()
        ):
            raise InvalidEvent("PostGIS rejected the event geometry") from error
        raise


def changes(after: int, limit: int) -> list:
    with connect() as conn:
        return conn.execute("""
            SELECT seq, body AS event FROM twin.event WHERE seq>%s ORDER BY seq LIMIT %s
        """, (after, limit)).fetchall()


def snapshot(valid_at, known_at, timeline, branch, matrix, bbox, after, limit, watermark):
    west, south, east, north = bbox if bbox is not None else (-180, -90, 180, 90)
    with connect() as conn:
        if watermark is None:
            watermark = conn.execute("SELECT COALESCE(max(seq),0) AS mark FROM twin.event").fetchone()["mark"]
        rows = conn.execute("""
            SELECT seq, body AS event, ST_AsGeoJSON(geom)::jsonb AS geometry
            FROM twin.snapshot(%s,%s,%s,%s,%s)
            WHERE (%s::text IS NULL OR matrix=%s)
                AND (%s OR ST_Intersects(geom, ST_MakeEnvelope(%s,%s,%s,%s,4326)))
                AND (matrix,entity_id) > (%s,%s)
            ORDER BY matrix,entity_id LIMIT %s
        """, (valid_at, known_at, timeline, branch, watermark, matrix, matrix, bbox is None,
              west, south, east, north, *after, limit)).fetchall()
    return rows, watermark


def refresh():
    with connect() as conn:
        conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY twin.current_state")
        conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY twin.matrix_counts")
