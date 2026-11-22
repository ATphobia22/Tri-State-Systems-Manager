"""Real Compose integration: source receipt -> Kafka -> PostGIS -> state API.

No synthetic numeric water elevations are created by this test.
The source capture is a deterministic test fixture, never a live USGS claim.
"""
import json
import os

import httpx
import pytest

from twin.import_usgs import event_rows
from twin.kafka import publish
from twin.offline_bundle import build_bundle, verify_bundle
from twin.store import connect

from test_integration import wait_for
from test_offline_bundle import capture

API = os.getenv("STATE_API")
pytestmark = pytest.mark.skipif(not API, reason="Requires Compose PostGIS, Kafka and state API")


def test_real_source_shape_traverses_ingress_store_projection_and_offline_handoff(tmp_path):
    snapshot, _, _ = capture(tmp_path)
    observation, = event_rows(snapshot)
    # Exercise the actual connected Avro/Kafka producer rather than inserting
    # directly into the database. The generic integration suite covers relay.
    publish(observation)

    def committed():
        with connect() as conn:
            return conn.execute(
                "SELECT seq,digest FROM twin.event WHERE event_id=%s",
                (observation["event_id"],)
            ).fetchone()

    row = wait_for(committed)
    assert row["seq"] > 0
    with httpx.Client(base_url=API, timeout=8) as client:
        def projected():
            response = client.get("/twin/current", params={"matrix": "O", "limit": 250})
            response.raise_for_status()
            result = response.json()
            if result["watermark"] < row["seq"]:
                return None
            return next((entry for entry in result["entries"]
                         if entry["event"]["event_id"] == observation["event_id"]), None)

        projected_observation = wait_for(projected)
        actual = projected_observation["event"]
        assert actual["source"] == observation["source"]
        assert actual["state"]["quality"] == "Provisional"
        assert actual["state"]["value"] == 8.5
        assert actual["state"]["vertical_reference"] == "STATION_GAGE_DATUM_UNRESOLVED"

        historical = client.get(
            "/twin/time/2025-01-01T12:00:00Z",
            params={"matrix": "O", "limit": 250},
        )
        historical.raise_for_status()
        assert any(item["event"]["event_id"] == observation["event_id"]
                   for item in historical.json()["entries"])

    native = tmp_path / "native"
    receipt = build_bundle(snapshot, native)
    assert verify_bundle(native) == receipt
    record, = [json.loads(line) for line in (native / "events.ndjson").read_text().splitlines()]
    assert record == actual
    assert receipt["navd88WseIncluded"] is False
    assert receipt["hydraulicSimulationIncluded"] is False
