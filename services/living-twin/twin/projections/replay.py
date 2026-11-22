"""Durable, idempotent rebuild requests for projections and pgSTAC delivery."""
from ..store import connect
from .engine import WATERMARK, rebuild


class ReplayConflict(ValueError):
    pass


def submit(job_id, target):
    with connect() as conn:
        conn.execute("""
            INSERT INTO read_model.rebuild_job (job_id,target) VALUES (%s,%s)
            ON CONFLICT (job_id) DO NOTHING
        """, (job_id,target))
        row = conn.execute("SELECT * FROM read_model.rebuild_job WHERE job_id=%s", (job_id,)).fetchone()
        if row["target"] != target:
            raise ReplayConflict("Idempotency key already used for a different target")
        return row


def status(job_id):
    with connect() as conn:
        return conn.execute("""
            SELECT j.*, CASE WHEN j.target='stac' AND j.status='completed' THEN (
                SELECT count(*) FROM twin.outbox o
                WHERE o.destination='pgstac' AND o.event_seq<=j.watermark AND o.delivered_at IS NULL
            ) END AS pending_deliveries
            FROM read_model.rebuild_job j WHERE j.job_id=%s
        """, (job_id,)).fetchone()


def requeue_stac(conn):
    target = conn.execute(WATERMARK).fetchone()["mark"]
    rows = conn.execute("""
        INSERT INTO twin.outbox(event_seq,destination)
        SELECT seq,'pgstac' FROM twin.event
        WHERE seq<=%s AND body->'asset' <> 'null'::jsonb
        ORDER BY seq
        ON CONFLICT (event_seq,destination) DO UPDATE SET
            attempts=0,available_at=clock_timestamp(),last_error=NULL,delivered_at=NULL
    """, (target,))
    return target, rows.rowcount


def process_one() -> bool:
    with connect() as conn:
        row = conn.execute("""
            SELECT job_id,target,attempts FROM read_model.rebuild_job
            WHERE status='queued' AND available_at<=clock_timestamp()
            ORDER BY submitted_at,job_id LIMIT 1 FOR UPDATE SKIP LOCKED
        """).fetchone()
        if row is None:
            return False
        try:
            with conn.transaction():
                conn.execute("SET LOCAL statement_timeout='2min'")
                action = rebuild if row["target"] == "projections" else requeue_stac
                watermark, affected = action(conn)
            conn.execute("""
                UPDATE read_model.rebuild_job SET status='completed', attempts=attempts+1,
                    watermark=%s,affected=%s,finished_at=clock_timestamp(),last_error=NULL
                WHERE job_id=%s
            """, (watermark,affected,row["job_id"]))
        except Exception as error:
            failed = row["attempts"] + 1 >= 5
            conn.execute("""
                UPDATE read_model.rebuild_job SET status=%s, attempts=attempts+1,
                    available_at=clock_timestamp()+make_interval(secs=>%s),last_error=%s,
                    finished_at=CASE WHEN %s THEN clock_timestamp() ELSE NULL END
                WHERE job_id=%s
            """, ("failed" if failed else "queued", 2 ** (row["attempts"] + 1),
                  type(error).__name__, failed, row["job_id"]))
        return True
