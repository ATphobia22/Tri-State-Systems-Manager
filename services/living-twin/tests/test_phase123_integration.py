"""End-to-end proofs against Compose PostGIS, CQRS kernel and state API."""
import os
from uuid import uuid4
import httpx
import pytest
from twin.asset_shells import make_event
from twin.hydrology_validation import compare, validation_event
from twin.store import apply, connect
from test_integration import wait_for

API = os.getenv("STATE_API")
pytestmark = pytest.mark.skipif(not API, reason="Requires living-twin Compose integration")

def source():
    return {"authority": "TEST_FIXTURE", "uri": "https://example.org/hydro-test",
            "sha256": "a" * 64, "retrieved_at": "2025-02-01T00:00:00Z"}

def test_asset_version_replay_and_aas_api():
    asset_id = str(uuid4())
    params = {"asset_id": asset_id, "asset_type": "bridge", "name": "Synthetic bridge",
              "version": 1, "source": source(), "valid_from": "2025-01-01T00:00:00Z",
              "geometry": {"type": "Point", "coordinates": [-87.9, 38.1]}}
    first = make_event(**params)
    second = make_event(**{**params, "version": 2, "valid_from": "2025-02-01T00:00:00Z"})
    seq1, inserted1 = apply(first)
    seq2, inserted2 = apply(second)
    assert inserted1 and inserted2 and seq2 > seq1
    assert apply(second) == (seq2, False)
    with httpx.Client(base_url=API, timeout=5) as client:
        def current():
            response = client.get(f"/twin/assets/{asset_id}")
            if response.status_code != 200:
                return None
            return response.json() if response.json()["state"]["version"] == 2 else None
        assert wait_for(current)["event_id"] == second["event_id"]
        response = client.get(f"/twin/assets/{asset_id}/aas")
        assert response.is_success, response.text
        assert response.json()["shell"]["assetInformation"]["globalAssetId"] == "urn:uuid:" + asset_id
        assert client.get(f"/twin/assets/{asset_id}/relationships").json()["relationships"] == []
        historical = client.get("/twin/time/2025-01-15T00:00:00Z", params={"matrix": "I", "limit": 250})
        assert historical.is_success
        assert any(row["event"]["event_id"] == first["event_id"] for row in historical.json()["entries"])

def test_hydrology_validation_creates_evidence_linked_event():
    station = "USGS-03378500"
    time = "2025-01-01T12:00:00Z"
    common = {"version": 1, "operation": "upsert", "geometry": None,
              "asset": None, "valid_from": time, "evidence": [], "source": source()}
    observation = {**common, "event_id": str(uuid4()), "matrix": "O",
                   "entity_id": "usgs:sample:" + uuid4().hex, "timeline": "observed", "branch": "main",
                   "state": {"sensor_id": station, "parameter": "00065", "value": 8.,
                             "unit": "ft", "quality": "Provisional",
                             "vertical_reference": "STATION_GAGE_DATUM_UNRESOLVED"}}
    prediction = {**common, "event_id": str(uuid4()), "matrix": "H",
                  "entity_id": "run:" + uuid4().hex, "timeline": "forecast",
                  "branch": "model-run", "state": {
                      "reach_id": "reach:test", "station_id": station, "stage_ft": 308.2,
                      "unit": "ft", "vertical_reference": "NAVD88"}}
    apply(observation)
    apply(prediction)
    assert compare(observation, prediction)["status"] == "WITHHELD"
    reviewed_datum = {"station_id": station, "offset_ft": 300., "datum": "NAVD88",
                      "reviewed": True, "uncertainty_ft": .1,
                      "evidence_uri": "https://example.org/datum-reviewed",
                      "sha256": "f" * 64, "effective_from": "2024-01-01T00:00:00Z",
                      "effective_to": "2026-01-01T00:00:00Z"}
    result = compare(observation, prediction, gage_zero=reviewed_datum)
    assert result["residual_ft"] == pytest.approx(.2)
    val = validation_event(observation, prediction, result,
                           validated_at="2025-02-01T10:00:00Z")
    seq, inserted = apply(val)
    assert inserted and apply(val) == (seq, False)
    with connect() as conn:
        links = conn.execute("SELECT relationship FROM twin.evidence_link WHERE event_seq=%s",
                             (seq,)).fetchall()
        assert {link["relationship"] for link in links} == {"validates", "derived_from"}
