"""Restart-safe relay with separate Kafka and pgSTAC delivery receipts."""
import logging
import time

from opentelemetry import trace
from prometheus_client import start_http_server

from .catalog import deliver, prepare_catalog
from .contracts import stream_key
from .kafka import Wire, producer, send
from .observability import BACKLOG, DELIVERY, REFRESH, TRACE_CONTEXT, Circuit, setup
from .settings import CHANGE
from .store import connect, refresh

CLAIM = """
    SELECT o.event_seq,o.attempts,o.trace_headers,e.body AS event, ST_AsGeoJSON(e.geom)::jsonb AS geometry,
           CASE WHEN e.geom IS NOT NULL THEN ARRAY[
               ST_XMin(e.geom),ST_YMin(e.geom),ST_XMax(e.geom),ST_YMax(e.geom)
           ] END AS bbox
    FROM twin.outbox o JOIN twin.event e ON e.seq=o.event_seq
    WHERE o.destination=%s AND o.delivered_at IS NULL AND o.available_at<=clock_timestamp()
    ORDER BY o.event_seq
    LIMIT 1 FOR UPDATE OF o SKIP LOCKED
"""


def deliver_one(destination, dispatch):
    with connect() as conn:
        row = conn.execute(CLAIM, (destination,)).fetchone()
        if row is None:
            return "idle"
        try:
            # A savepoint lets database-side publisher failures record a retry in this transaction.
            with trace.get_tracer("tsm.living_twin").start_as_current_span(
                "twin.outbox.delivery", context=TRACE_CONTEXT.extract(row["trace_headers"]),
                attributes={"tsm.outbox.destination": destination},
            ), conn.transaction():
                dispatch(conn, row)
        except Exception as error:
            retry_after = min(300, 2 ** min(row["attempts"] + 1, 9))
            conn.execute("""
                UPDATE twin.outbox SET attempts=attempts+1,
                    available_at=clock_timestamp()+make_interval(secs=>%s),last_error=%s
                WHERE event_seq=%s AND destination=%s
            """, (retry_after, type(error).__name__, row["event_seq"], destination))
            return "retry"
        conn.execute("""
            UPDATE twin.outbox SET delivered_at=clock_timestamp(),attempts=attempts+1,last_error=NULL
            WHERE event_seq=%s AND destination=%s
        """, (row["event_seq"], destination))
        return "delivered"


def report_backlog():
    with connect() as conn:
        results = conn.execute("""
            SELECT destination,count(*) AS total FROM twin.outbox
            WHERE delivered_at IS NULL GROUP BY destination
        """).fetchall()
    counts = {row["destination"]: row["total"] for row in results}
    for name in ("kafka", "pgstac"):
        BACKLOG.labels(name).set(counts.get(name, 0))


def run():
    setup("living-twin-relay")
    start_http_server(9102)
    wire, outgoing = Wire(), producer()
    with connect() as conn:
        prepare_catalog(conn)

    def send_change(_conn, row):
        event = row["event"]
        send(outgoing, CHANGE, stream_key(event), wire.pack(event, CHANGE),
             headers={"tsm-seq": str(row["event_seq"])})

    destinations = {"kafka": send_change, "pgstac": deliver}
    circuits = {name: Circuit(name) for name in destinations}
    last_refresh = 0.0
    while True:
        worked = False
        for name, dispatch in destinations.items():
            circuit = circuits[name]
            if not circuit.ready():
                continue
            try:
                outcome = deliver_one(name, dispatch)
            except Exception:
                logging.exception("Outbox transaction failed")
                outcome = "retry"
            if outcome != "idle":
                DELIVERY.labels(name, outcome).inc()
                (circuit.success if outcome == "delivered" else circuit.fail)()
                worked = True
        if time.monotonic() - last_refresh >= 15:
            try:
                refresh()
                report_backlog()
                REFRESH.labels("updated").inc()
            except Exception:
                REFRESH.labels("failed").inc()
                logging.exception("Materialized view refresh failed")
            last_refresh = time.monotonic()
        if not worked:
            time.sleep(0.5)


if __name__ == "__main__":
    run()
