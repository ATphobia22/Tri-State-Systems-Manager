"""Datum-safe, deterministic hydrologic model/observation comparisons.

Inputs are immutable O (USGS observations) and forecast/scenario H (model) events.
A gauge height is NOT a NAVD88 water-surface elevation without a reviewed
station-specific gage-zero record. No implicit geoid/datum transformations.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import math
from uuid import NAMESPACE_URL, uuid5

from .contracts import canonical, validate

WITHHELD = "WITHHELD"
VALIDATED = "VALIDATED"


def _utc(value: str) -> datetime:
    stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if stamp.utcoffset() is None:
        raise ValueError("Timezone offset required")
    return stamp.astimezone(timezone.utc)


def _quantity(value, *, label: str, allow_zero=True) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{label} must be numeric")
    result = float(value)
    if not math.isfinite(result) or (not allow_zero and result < 0):
        raise ValueError(f"{label} must be finite and nonnegative")
    return result


def _withhold(reason, observation, prediction):
    return {"status": WITHHELD, "reason": reason, "observation_event_id": observation["event_id"],
            "prediction_event_id": prediction["event_id"]}


def compare(observation: dict, prediction: dict, *, gage_zero: dict | None = None,
            max_skew_seconds: int = 0) -> dict:
    """Return a residual only when type, station, time, units and datums reconcile.

    gage_zero requires station_id, offset_ft, datum='NAVD88', reviewed=True,
    evidence_uri, sha256, uncertainty_ft and effective_from/effective_to.
    Reviewed means externally documented; the function does not review evidence.
    """
    validate(observation)
    validate(prediction)
    if observation["matrix"] != "O" or observation["timeline"] != "observed":
        return _withhold("NOT_AUTHORITATIVE_OBSERVATION", observation, prediction)
    if prediction["matrix"] != "H" or prediction["timeline"] not in ("forecast", "scenario"):
        return _withhold("NOT_MODEL_PREDICTION", observation, prediction)
    # Prevent a structurally valid O event from impersonating a USGS observation.
    if observation.get("source", {}).get("authority") != "USGS":
        return _withhold("OBSERVATION_SOURCE_NOT_USGS", observation, prediction)
    o, p = observation["state"], prediction["state"]
    if o.get("vertical_reference") not in ("STATION_GAGE_DATUM_UNRESOLVED", "NAVD88"):
        return _withhold("UNSUPPORTED_OBSERVATION_DATUM", observation, prediction)
    if (o.get("sensor_id") != p.get("station_id") or
            not isinstance(o.get("sensor_id"), str)):
        return _withhold("STATION_MISMATCH", observation, prediction)
    if o.get("parameter") != "00065":
        return _withhold("NOT_GAGE_HEIGHT", observation, prediction)
    if o.get("unit") != "ft" or p.get("unit") != "ft":
        return _withhold("UNIT_MISMATCH", observation, prediction)
    if p.get("vertical_reference") != "NAVD88":
        return _withhold("MODEL_DATUM_NOT_NAVD88", observation, prediction)
    if not isinstance(max_skew_seconds, int) or isinstance(max_skew_seconds, bool) or max_skew_seconds < 0:
        raise ValueError("max_skew_seconds must be a nonnegative integer")
    obs_time, model_time = _utc(observation["valid_from"]), _utc(prediction["valid_from"])
    skew = abs((obs_time - model_time).total_seconds())
    if skew > max_skew_seconds:
        return _withhold("TIMESTAMP_MISMATCH", observation, prediction)
    if o.get("value") is None or p.get("stage_ft") is None:
        return _withhold("MISSING_MEASUREMENT", observation, prediction)
    observed_stage = _quantity(o["value"], label="gage height")
    predicted_wse = _quantity(p["stage_ft"], label="predicted NAVD88 water surface")
    datum_uncertainty = 0.0
    datum_evidence = None
    if o.get("vertical_reference") == "NAVD88":
        observed_wse = observed_stage
    else:
        if not gage_zero or gage_zero.get("reviewed") is not True:
            return _withhold("GAGE_ZERO_UNREVIEWED", observation, prediction)
        if (gage_zero.get("station_id") != o["sensor_id"] or
                gage_zero.get("datum") != "NAVD88" or
                not isinstance(gage_zero.get("evidence_uri"), str) or
                not gage_zero["evidence_uri"].startswith("https://") or
                not isinstance(gage_zero.get("sha256"), str) or
                len(gage_zero["sha256"]) != 64 or
                any(c not in "0123456789abcdef" for c in gage_zero["sha256"])):
            return _withhold("GAGE_ZERO_EVIDENCE_INVALID", observation, prediction)
        try:
            valid_from = _utc(gage_zero["effective_from"])
            valid_to = _utc(gage_zero["effective_to"])
        except (KeyError, ValueError, TypeError):
            return _withhold("GAGE_ZERO_INTERVAL_INVALID", observation, prediction)
        if not valid_from <= obs_time < valid_to:
            return _withhold("GAGE_ZERO_OUTSIDE_VALIDITY", observation, prediction)
        observed_wse = observed_stage + _quantity(gage_zero["offset_ft"], label="gage-zero offset")
        datum_uncertainty = _quantity(gage_zero["uncertainty_ft"],
                                      label="gage-zero uncertainty", allow_zero=False)
        datum_evidence = {"uri": gage_zero["evidence_uri"], "sha256": gage_zero["sha256"]}
    obs_unc = o.get("uncertainty_ft")
    pred_unc = p.get("uncertainty_ft")
    combined = None
    if obs_unc is not None and pred_unc is not None:
        combined = math.sqrt(_quantity(obs_unc, label="observation uncertainty", allow_zero=False) ** 2 +
                             _quantity(pred_unc, label="prediction uncertainty", allow_zero=False) ** 2 +
                             datum_uncertainty ** 2)
    residual = predicted_wse - observed_wse
    return {
        "status": VALIDATED, "observation_event_id": observation["event_id"],
        "prediction_event_id": prediction["event_id"], "station_id": o["sensor_id"],
        "observation_time": obs_time.isoformat(), "prediction_time": model_time.isoformat(),
        "time_skew_seconds": skew, "vertical_datum": "NAVD88", "unit": "ft",
        "observed_wse_ft": observed_wse, "predicted_wse_ft": predicted_wse,
        "residual_ft": residual, "absolute_error_ft": abs(residual),
        "combined_uncertainty_ft": combined,
        "normalized_residual": residual / combined if combined and combined > 0 else None,
        "gage_zero_evidence": datum_evidence,
        "source_observation_sha256": observation["source"]["sha256"],
        "source_prediction_sha256": prediction["source"]["sha256"],
    }


def validation_event(observation: dict, prediction: dict, result: dict, *,
                     validated_at: str, observation_use: str = "unknown") -> dict:
    """Create an idempotent matrix-V evidence event; caller persists with store.apply."""
    if result["status"] != VALIDATED:
        raise ValueError("Cannot publish a withheld comparison as validated")
    if observation_use not in ("fit", "withheld", "unknown"):
        raise ValueError("Invalid calibration-use classification")
    _utc(validated_at)
    payload = {"result": result, "validated_at": validated_at, "observation_use": observation_use}
    digest = hashlib.sha256(canonical(payload).encode()).hexdigest()
    identity = str(uuid5(NAMESPACE_URL, canonical(payload)))
    event = {
        "version": 1, "event_id": identity, "matrix": "V", "entity_id": "validation:" + identity,
        "timeline": "observed", "branch": "main", "valid_from": observation["valid_from"],
        "operation": "upsert", "geometry": observation["geometry"],
        "state": {"metric": "model_minus_observed_wse", "sample_count": 1,
                  "observation_use": observation_use, "unit": "ft", **result},
        "source": {"authority": "TSM_VALIDATION_PIPELINE",
                   "uri": "https://github.com/ATphobia22/Tri-State-Systems-Manager",
                   "retrieved_at": validated_at, "sha256": digest},
        "evidence": [{"event_id": observation["event_id"], "relationship": "validates"},
                     {"event_id": prediction["event_id"], "relationship": "derived_from"}],
        "asset": None,
    }
    validate(event)
    return event
