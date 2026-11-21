import os
import time

from alembic import command
from alembic.config import Config
from confluent_kafka import Consumer
import httpx
import psycopg
from urllib.parse import urlsplit
import pytest
from websockets.sync.client import connect as websocket

from twin.contracts import stream_key
from twin.kafka import Wire, producer, publish, registry, send
from twin.relay import deliver_one
from twin.settings import CHANGE, COLLECTION, DATABASE, DEAD, INGRESS, KAFKA
from twin.store import apply, connect

API = os.getenv("TWIN_API")
pytestmark = pytest.mark.skipif(not API, reason="Compose integration services required")


def wait_for(check, timeout=30):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        result = check()
        if result:
            return result
        time.sleep(0.15)
    raise AssertionError("Integration condition timed out")


def row_for(event):
    with connect() as conn:
        return conn.execute(
            "SELECT seq,recorded_at FROM twin.event WHERE event_id=%s", (event["event_id"],)
        ).fetchone()


def test_full_pipeline(event, revision):
    event["asset"] = {"href": "https://example.org/terrain.tif", "media_type": "image/tiff", "sha256": "b" * 64}
    assert registry().get_compatibility(f"{INGRESS}-value") == "FULL_TRANSITIVE"
    listener = Consumer({"bootstrap.servers": KAFKA, "group.id": event["event_id"],
                         "auto.offset.reset": "earliest", "enable.auto.commit": False})
    listener.subscribe([CHANGE, DEAD])
    try:
        publish(event)
        accepted = wait_for(lambda: row_for(event))
        publish(event)
        corrected = revision(event, state={**event["state"], "qc": "corrected"}, asset=None,
                             evidence=[{"event_id": event["event_id"], "relationship": "supersedes"}])
        publish(corrected)
        corrected_row = wait_for(lambda: row_for(corrected))
        with connect() as conn:
            audit = conn.execute("SELECT count(*) AS n FROM twin.audit WHERE event_seq=%s", (accepted["seq"],)).fetchone()
            assert audit["n"] == 1
            assert conn.execute("SELECT count(*) AS n FROM twin.evidence_link WHERE event_seq=%s",
                                (corrected_row["seq"],)).fetchone()["n"] == 1
        def stac_item():
            with connect() as conn:
                return conn.execute("SELECT id FROM pgstac.items WHERE collection=%s AND id=%s",
                                    (COLLECTION, event["event_id"])).fetchone()
        assert wait_for(stac_item)
        old_point = (accepted["recorded_at"] + (corrected_row["recorded_at"] - accepted["recorded_at"]) / 2).isoformat()
        with httpx.Client(base_url=API) as client:
            old = client.get("/v1/snapshot", params={"matrix":"T", "known_at":old_point}).json()
            assert any(item["event"]["event_id"] == event["event_id"] for item in old["entries"])
            result = client.get("/v1/cesium", params={"matrix":"T","bbox":"-88,38,-87,39"})
            assert result.is_success, result.text
            assert any(item["properties"]["event_id"] == corrected["event_id"] for item in result.json()["features"])
        with websocket(API.replace("http://", "ws://") + f"/v1/live?after={accepted['seq']}") as socket:
            assert corrected["event_id"] in socket.recv(timeout=8)
        send(producer(), INGRESS, stream_key(event), b"invalid-frame")
        received = set()
        wire = Wire()
        def read_events():
            item = listener.poll(0.3)
            if item is None or item.error():
                return None
            if item.topic() == DEAD and b"Invalid Avro value" in item.value():
                received.add("dead-letter")
            if item.topic() == CHANGE and wire.unpack(item.value(), CHANGE)["event_id"] == event["event_id"]:
                received.add("change")
            return received == {"dead-letter", "change"}
        wait_for(read_events)
    finally:
        listener.close()


def test_alembic_reversible_and_outbox_retry(event, monkeypatch):
    database = urlsplit(DATABASE)._replace(path="/twin_migration_test").geturl()
    with psycopg.connect(DATABASE, autocommit=True) as server:
        server.execute("DROP DATABASE IF EXISTS twin_migration_test WITH (FORCE)")
        server.execute("CREATE DATABASE twin_migration_test")
    try:
        monkeypatch.setenv("DATABASE_URL", database)
        command.upgrade(Config("alembic.ini"), "head")
        monkeypatch.setattr("twin.relay.connect", lambda: connect(database))
        seq, inserted = apply(event, database)
        assert inserted
        def fail(_conn, _row):
            raise OSError("dependency unavailable")
        assert deliver_one("kafka", fail) == "retry"
        with connect(database) as conn:
            row = conn.execute("SELECT * FROM twin.outbox WHERE event_seq=%s", (seq,)).fetchone()
            assert row["attempts"] == 1 and row["delivered_at"] is None
            conn.execute("UPDATE twin.outbox SET available_at=clock_timestamp() WHERE event_seq=%s", (seq,))
        assert deliver_one("kafka", lambda _conn, row: row["event_seq"] == seq) == "delivered"
        with pytest.raises(psycopg.errors.RaiseException), connect(database) as conn:
            conn.execute("UPDATE twin.event SET operation='retire' WHERE seq=%s", (seq,))
        command.downgrade(Config("alembic.ini"), "base")
        with connect(database) as conn:
            assert conn.execute("SELECT to_regnamespace('twin') IS NULL AS removed").fetchone()["removed"]
            assert conn.execute("SELECT to_regtype('geometry') IS NOT NULL AS kept").fetchone()["kept"]
    finally:
        with psycopg.connect(DATABASE, autocommit=True) as server:
            server.execute("DROP DATABASE twin_migration_test WITH (FORCE)")
