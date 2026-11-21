import os
from uuid import uuid4

import httpx
import pytest
from websockets.sync.client import connect as websocket

from twin.contracts import InvalidEvent
from twin.store import apply, connect

from test_integration import wait_for

API = os.getenv("STATE_API")
pytestmark = pytest.mark.skipif(not API, reason="Compose state API and kernel required")


def test_ordered_projection_and_rebuild(event, revision):
    reach = f"reach:{uuid4()}"
    first = revision(event, matrix="H", entity_id=reach, state={
        "reach_id": reach, "river_name": "Ohio", "stage_ft": 10,
        "vertical_reference": "SYNTHETIC_GAGE_DATUM",
    })
    mark, inserted = apply(first)
    assert inserted and apply(first) == (mark, False)
    with pytest.raises(InvalidEvent):
        apply({**first, "state": {**first["state"], "stage_ft": 999}})
    assert apply(revision(first, valid_from="2025-01-01T00:00:00Z",
                          state={**first["state"], "stage_ft": 5}))[1]
    newer = revision(first, state={**first["state"], "stage_ft": 11})
    expected, _ = apply(newer)
    last, _ = apply(revision(first, timeline="forecast", branch="test-forecast",
                             valid_from="2025-01-03T00:00:00Z"))
    with httpx.Client(base_url=API, timeout=5) as client:
        def page():
            response = client.get("/twin/current/hydrology")
            response.raise_for_status()
            return response.json()

        def up_to_date():
            data = page()
            return data if data["watermark"] >= last else None
        before = wait_for(up_to_date)
        assert next(row["seq"] for row in before["entries"] if row["entity_id"] == reach) == expected
        assert {row["event"]["state"]["stage_ft"] for row in before["entries"] if row["entity_id"] == reach} == {11}
        with websocket(API.replace("http://", "ws://") + f"/twin/live?after={mark}") as socket:
            assert newer["event_id"] in socket.recv(timeout=8)
        time = client.get("/twin/time/2025-01-01T12:00:00Z", params={"matrix":"H"})
        assert time.is_success
        assert next(row for row in time.json()["entries"] if row["event"]["entity_id"] == reach)["event"]["state"]["stage_ft"] == 5
        store = client.get("/cesium/live/hydrology", params={"bbox":"-88,38,-87,39"})
        assert any(feature["id"] == reach for feature in store.json()["features"])

        token = os.getenv("TWIN_REBUILD_TOKEN")
        if token:
            job_id = str(uuid4())
            url = "/rebuild/projections"
            assert client.post(url, headers={"Idempotency-Key":job_id}).status_code == 401
            headers = {"Idempotency-Key":job_id, "Authorization":f"Bearer {token}"}
            assert client.post(url, headers=headers).status_code == 202
            assert client.post(url, headers=headers).json()["job_id"] == job_id
            assert client.post("/rebuild/stac", headers=headers).status_code == 409

            def completed():
                job = client.get(f"/rebuild/jobs/{job_id}", headers=headers).json()
                assert job["status"] != "failed", job
                return job if job["status"] == "completed" else None

            receipt = wait_for(completed)
            after = page()
            assert before["entries"] == after["entries"]
            assert after["watermark"] == receipt["watermark"]
            assert before["view_version"] != after["view_version"]
            assert client.get("/twin/current/hydrology", params={
                "view_version":before["view_version"],
            }).status_code == 409

        retired, _ = apply(revision(first, operation="retire", geometry=None, state={}))
        def observed_after(seq):
            data = page()
            return data if data["watermark"] >= seq else None

        assert all(row["entity_id"] != reach for row in wait_for(lambda: observed_after(retired))["entries"])
        late, _ = apply(revision(first, valid_from="2025-01-01T03:00:00Z"))
        assert all(row["entity_id"] != reach for row in wait_for(lambda: observed_after(late))["entries"])


def test_stac_replay_restores_missing_item(event, revision):
    token = os.getenv("TWIN_REBUILD_TOKEN")
    if not token:
        pytest.skip("Configure TWIN_REBUILD_TOKEN for replay tests")
    event = revision(event, entity_id=f"terrain:{uuid4()}", asset={
        "href":"https://example.org/sample.tif", "media_type":"image/tiff", "sha256":"b"*64,
    })
    seq, _ = apply(event)

    def has_item():
        with connect() as conn:
            return conn.execute(
                "SELECT id FROM pgstac.items WHERE collection='tsm-twin-assets' AND id=%s",
                (event["event_id"],),
            ).fetchone()

    assert wait_for(has_item)
    with connect() as conn:
        conn.execute("DELETE FROM pgstac.items WHERE collection='tsm-twin-assets' AND id=%s",
                     (event["event_id"],))
    assert not has_item()
    with httpx.Client(base_url=API, timeout=5) as client:
        key = str(uuid4())
        headers = {"Authorization":f"Bearer {token}", "Idempotency-Key":key}
        response = client.post("/rebuild/stac", headers=headers)
        assert response.status_code == 202, response.text
        def complete():
            job = client.get(f"/rebuild/jobs/{key}", headers=headers).json()
            assert job["status"] != "failed", job
            return job if job["status"] == "completed" else None
        job = wait_for(complete)
        assert job["watermark"] >= seq and job["affected"] >= 1
        assert wait_for(has_item)
        assert wait_for(lambda: client.get(f"/rebuild/jobs/{key}", headers=headers).json()["pending_deliveries"] == 0)


def test_state_api_database_role_cannot_write_history():
    import psycopg

    database = os.getenv("STATE_DATABASE_URL")
    if not database:
        pytest.skip("State API database role required")
    with connect(database) as conn:
        assert conn.execute("SELECT count(*) AS n FROM twin.event").fetchone()["n"] >= 0
    for statement in (
        "UPDATE twin.event SET operation='retire' WHERE false",
        "DELETE FROM read_model.current_entity WHERE false",
        "UPDATE read_model.rebuild_job SET status='completed' WHERE false",
    ):
        with pytest.raises(psycopg.errors.InsufficientPrivilege), connect(database) as conn:
            conn.execute(statement)
