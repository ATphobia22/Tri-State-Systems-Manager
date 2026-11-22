"""Checkpointed projections over the committed event store, including tombstones."""
from ..store import connect

LOCK = "SELECT pg_advisory_xact_lock(946322, 2)"
CHECKPOINT = "SELECT last_seq, generation FROM read_model.checkpoint WHERE projection='current'"
WATERMARK = "SELECT COALESCE(max(seq), 0) AS mark FROM twin.event"

# At most one candidate per identity in a batch. Late effective-time history
# stays in the event store; equal-time corrections are decided by committed seq.
PROJECT = """
    INSERT INTO read_model.current_entity
        (matrix, entity_id, event_seq, valid_from, recorded_at, retired, geom, body)
    SELECT DISTINCT ON (matrix,entity_id)
        matrix, entity_id, seq, valid_from, recorded_at, operation='retire', geom, body
    FROM twin.event
    WHERE seq > %s AND seq <= %s AND timeline='observed' AND branch='main'
    ORDER BY matrix, entity_id, valid_from DESC, seq DESC
    ON CONFLICT (matrix, entity_id) DO UPDATE SET
        event_seq=EXCLUDED.event_seq, valid_from=EXCLUDED.valid_from,
        recorded_at=EXCLUDED.recorded_at, retired=EXCLUDED.retired,
        geom=EXCLUDED.geom, body=EXCLUDED.body
    WHERE (EXCLUDED.valid_from,EXCLUDED.event_seq) >
          (current_entity.valid_from,current_entity.event_seq)
"""


def advance(batch_size: int = 500) -> int:
    with connect() as conn:
        conn.execute(LOCK)
        after = conn.execute(CHECKPOINT).fetchone()["last_seq"]
        batch = conn.execute("""
            SELECT max(seq) AS mark, count(*) AS size
            FROM (SELECT seq FROM twin.event WHERE seq>%s ORDER BY seq LIMIT %s) wanted
        """, (after, batch_size)).fetchone()
        if batch["size"]:
            conn.execute(PROJECT, (after, batch["mark"]))
            conn.execute("""
                UPDATE read_model.checkpoint SET last_seq=%s,recorded_at=clock_timestamp()
                WHERE projection='current'
            """, (batch["mark"],))
        return batch["size"]


def rebuild(conn) -> tuple[int, int]:
    conn.execute(LOCK)
    target = conn.execute(WATERMARK).fetchone()["mark"]
    # DELETE, not TRUNCATE, lets concurrent readers see the old complete state via MVCC.
    conn.execute("DELETE FROM read_model.current_entity")
    conn.execute(PROJECT, (0, target))
    affected = conn.execute("SELECT count(*) AS n FROM read_model.current_entity").fetchone()["n"]
    conn.execute("""
        UPDATE read_model.checkpoint
        SET last_seq=%s,generation=generation+1,recorded_at=clock_timestamp()
        WHERE projection='current'
    """, (target,))
    return target, affected
