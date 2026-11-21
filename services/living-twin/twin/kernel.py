"""Coordinate projection catch-up, rebuild jobs and audit-safe delivery workers."""
import logging
import time

from prometheus_client import Counter, start_http_server

from .observability import setup
from .projections.engine import advance
from .projections.replay import process_one

PROJECTED = Counter("twin_projection_events_scanned", "Events scanned by the projection checkpoint")
REPLAY = Counter("twin_rebuild_jobs_processed", "Rebuild job attempts")
LOOP_ERRORS = Counter("twin_kernel_failures", "Kernel transaction failures")


def run():
    tracer = setup("living-twin-kernel")
    start_http_server(9103)
    while True:
        try:
            with tracer.start_as_current_span("twin.kernel.project"):
                count = advance()
                PROJECTED.inc(count)
            with tracer.start_as_current_span("twin.kernel.replay"):
                worked = process_one()
                if worked:
                    REPLAY.inc()
            if not count and not worked:
                time.sleep(0.4)
        except Exception:
            LOOP_ERRORS.inc()
            logging.exception("Kernel transaction failed")
            time.sleep(2)


if __name__ == "__main__":
    run()
