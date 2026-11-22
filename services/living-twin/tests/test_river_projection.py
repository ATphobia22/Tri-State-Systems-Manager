import os
from pathlib import Path

import httpx
import pytest

from twin.contracts import decode, encode
from twin.import_usgs import event_rows
from twin.project_usgs import project

CAPTURE = Path(__file__).parent / "data" / "usgs-20261122"


def test_captured_gages_round_trip():
    rows = event_rows(CAPTURE)
    assert len({r["event_id"] for r in rows}) == len(rows) == 66
    assert {r["state"]["sensor_id"] for r in rows} == {
        "USGS-03322000", "USGS-03378500", "USGS-03377500",
    }
    assert all(decode(encode(row)) == row for row in rows)


@pytest.mark.skipif(not os.getenv("STATE_API"), reason="Requires Compose state API")
def test_capture_reaches_public_read_model_and_reimport_is_idempotent():
    receipt = project(CAPTURE)
    assert receipt["events_verified"] == receipt["current_at_checkpoint"] == 66
    assert project(CAPTURE) == receipt
    response = httpx.get(os.environ["STATE_API"] + "/twin/current/hydrology", timeout=5)
    response.raise_for_status()
    gauges = response.json()["gauges"]
    captured = [g["event"] for g in gauges if g["event"]["event_id"] in receipt["committed_ids"]]
    assert {e["state"]["sensor_id"] for e in captured} == {
        "USGS-03322000", "USGS-03378500", "USGS-03377500",
    }
