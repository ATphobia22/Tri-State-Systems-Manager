from copy import deepcopy
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from twin.hydrology_validation import compare, validation_event
from twin.contracts import validate

STATION = "USGS-03378500"
TIME = "2025-01-01T12:00:00Z"


def source():
    return {"authority": "USGS", "uri": "https://api.waterdata.usgs.gov/ogcapi/v1/",
            "retrieved_at": "2025-01-02T12:00:00Z", "sha256": "a" * 64}


def events():
    common = {"version": 1, "operation": "upsert", "geometry": None, "asset": None,
              "valid_from": TIME, "evidence": [], "source": source()}
    observed = {**common, "event_id": str(uuid4()), "matrix": "O",
                "entity_id": "usgs:03378500:test", "timeline": "observed", "branch": "main",
                "state": {"sensor_id": STATION, "parameter": "00065", "value": 8.,
                          "unit": "ft", "quality": "Approved",
                          "vertical_reference": "STATION_GAGE_DATUM_UNRESOLVED",
                          "uncertainty_ft": .1}}
    model = {**common, "event_id": str(uuid4()), "matrix": "H",
             "entity_id": "model:reach:test", "timeline": "forecast", "branch": "model-run",
             "state": {"reach_id": "reach:test", "station_id": STATION,
                       "stage_ft": 308.2, "unit": "ft", "vertical_reference": "NAVD88",
                       "uncertainty_ft": .2, "model_engine": "HEC-RAS"}}
    validate(observed)
    validate(model)
    return observed, model


def datum():
    return {"station_id": STATION, "offset_ft": 300., "datum": "NAVD88",
            "reviewed": True, "uncertainty_ft": .05,
            "evidence_uri": "https://example.org/reviewed-datum",
            "sha256": "b" * 64, "effective_from": "2024-01-01T00:00:00Z",
            "effective_to": "2026-01-01T00:00:00Z"}


def test_unreviewed_datum_cannot_produce_residual():
    observed, model = events()
    assert compare(observed, model)["reason"] == "GAGE_ZERO_UNREVIEWED"
    with pytest.raises(ValueError):
        validation_event(observed, model, compare(observed, model), validated_at=TIME)


def test_reviewed_conversion_uncertainty_and_determinism():
    obs, model = events()
    original = deepcopy(obs)
    result = compare(obs, model, gage_zero=datum())
    assert result["status"] == "VALIDATED"
    assert result["observed_wse_ft"] == pytest.approx(308.)
    assert result["residual_ft"] == pytest.approx(.2)
    assert result["combined_uncertainty_ft"] == pytest.approx((.1 ** 2 + .2 ** 2 + .05 ** 2) ** .5)
    first = validation_event(obs, model, result, validated_at="2025-01-03T00:00:00Z")
    second = validation_event(obs, model, result, validated_at="2025-01-03T00:00:00Z")
    assert first == second
    assert first["matrix"] == "V" and len(first["evidence"]) == 2
    assert obs == original


@pytest.mark.parametrize("override,reason", [
    ({"state": {"sensor_id": "USGS-03322000"}}, "STATION_MISMATCH"),
    ({"valid_from": "2025-01-01T12:01:00Z"}, "TIMESTAMP_MISMATCH"),
])
def test_alignment_withholds(override, reason):
    obs, model = events()
    if "state" in override:
        obs["state"].update(override["state"])
    else:
        model.update(override)
    assert compare(obs, model, gage_zero=datum())["reason"] == reason


def test_datum_window_and_bad_evidence_withhold():
    obs, model = events()
    bad = datum()
    bad["effective_to"] = "2024-11-01T00:00:00Z"
    assert compare(obs, model, gage_zero=bad)["reason"] == "GAGE_ZERO_OUTSIDE_VALIDITY"
    bad = datum()
    bad["reviewed"] = False
    assert compare(obs, model, gage_zero=bad)["reason"] == "GAGE_ZERO_UNREVIEWED"
    bad = datum()
    bad["sha256"] = "bad"
    assert compare(obs, model, gage_zero=bad)["reason"] == "GAGE_ZERO_EVIDENCE_INVALID"


def test_no_unit_or_timeline_shortcuts():
    obs, model = events()
    model["state"]["unit"] = "m"
    assert compare(obs, model, gage_zero=datum())["reason"] == "UNIT_MISMATCH"
    model["state"]["unit"] = "ft"
    model["timeline"], model["branch"] = "observed", "main"
    assert compare(obs, model, gage_zero=datum())["reason"] == "NOT_MODEL_PREDICTION"
