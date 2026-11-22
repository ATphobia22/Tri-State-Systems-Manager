"""Publish a captured river snapshot and verify committed evidence at a projection checkpoint."""
import argparse
import hashlib
import json
from pathlib import Path
import time

from .contracts import fingerprint, stream_key
from .import_usgs import event_rows, read_bounded
from .kafka import Wire, producer, send
from .read.query import checkpoint, consistent
from .settings import INGRESS


def project(directory, timeout=90):
    manifest_bytes = read_bounded(directory / "manifest.json")
    rows = event_rows(directory)
    if read_bounded(directory / "manifest.json") != manifest_bytes:
        raise ValueError("Manifest changed during import")
    if not rows:
        raise ValueError("Capture has no eligible observations")
    expected = {row["event_id"]: fingerprint(row) for row in rows}
    wire, client = Wire(), producer()
    for row in {row["event_id"]: row for row in rows}.values():
        send(client, INGRESS, stream_key(row), wire.pack(row, INGRESS))

    deadline = time.monotonic() + timeout
    while True:
        with consistent() as conn:
            mark = checkpoint(conn)
            events = conn.execute("""
                SELECT e.event_id,e.digest,e.seq,p.event_seq AS projected_seq
                FROM twin.event e LEFT JOIN read_model.current_entity p
                  ON (p.matrix,p.entity_id)=(e.matrix,e.entity_id)
                WHERE e.event_id=ANY(%s::uuid[]) AND e.seq<=%s
            """, (list(expected), mark["last_seq"])).fetchall()
        if len(events) == len(expected):
            for event in events:
                if expected[str(event["event_id"])] != event["digest"]:
                    raise ValueError("Committed payload digest mismatch")
                if event["projected_seq"] is None or event["projected_seq"] < event["seq"]:
                    raise ValueError("Committed observation missing from projection")
            return {
                "schema": "tsm.river-twin.projection-receipt.v1",
                "manifest_sha256": hashlib.sha256(manifest_bytes).hexdigest(),
                "stations": {k: v["status"] for k, v in json.loads(manifest_bytes)["stations"].items()},
                "watermark": mark["last_seq"], "generation": mark["generation"],
                "instance_id": str(mark["instance_id"]),
                "events_verified": len(events),
                "current_at_checkpoint": sum(e["seq"] == e["projected_seq"] for e in events),
                "committed_ids": sorted(expected),
            }
        if time.monotonic() >= deadline:
            raise TimeoutError(f"Only {len(events)} of {len(expected)} observations reached the checkpoint")
        time.sleep(0.25)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path)
    print(json.dumps(project(parser.parse_args().snapshot), sort_keys=True))
