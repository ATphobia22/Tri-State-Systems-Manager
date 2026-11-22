"""Deterministic, local-only reader projection for verified USGS observation bundles.

A gage height in feet is not NAVD88 water-surface elevation. This module makes
no API calls and must not be used to certify observations or engineering models.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path

SCHEMA = "tsm.offline-gauge-view.v1"
PILOT_STATIONS = ("USGS-03322000", "USGS-03377500", "USGS-03378500")
ALLOWED_STATES = {"CAPTURED", "SOURCE_UNAVAILABLE", "NO_OBSERVATIONS"}


def _utc(value: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError("An offset-aware UTC timestamp is required")
    try:
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("Invalid timestamp") from error
    if timestamp.utcoffset() is None:
        raise ValueError("An offset-aware UTC timestamp is required")
    return timestamp.astimezone(timezone.utc)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def summarize_observations(receipt: dict, events: list[dict], *,
                           as_of: str | None = None,
                           stale_after_seconds: int = 3600) -> dict:
    """Produce a local presentation view; never fuse multiple USGS series.

    Input receipt/events must come from verify_bundle. as_of is injectable
    for reproducible tests and replay; omitted means the current UTC clock.
    """
    if (type(stale_after_seconds) is not int or
            not 0 < stale_after_seconds <= 31 * 86400):
        raise ValueError("stale_after_seconds must be a positive bounded integer")
    if (not isinstance(receipt, dict) or
            receipt.get("schema") != "tsm.offline-observation-bundle.v1" or
            receipt.get("navd88WseIncluded") is not False or
            receipt.get("publicPublication") != "REVIEW_REQUIRED"):
        raise ValueError("Invalid observation bundle authority declaration")
    captured_at = _utc(receipt.get("capturedAt"))
    observed_at = _utc(as_of) if as_of is not None else datetime.now(timezone.utc)
    if observed_at < captured_at:
        raise ValueError("as_of cannot precede the verified capture time")
    states = receipt.get("sourceStates")
    if not isinstance(states, dict) or not set(states) <= set(PILOT_STATIONS):
        raise ValueError("Invalid source station inventory")
    stations = {}
    for station_id in PILOT_STATIONS:
        source = states.get(station_id)
        if source is None:
            stations[station_id] = {"sourceStatus": "NOT_IN_CAPTURE", "series": []}
            continue
        if (not isinstance(source, dict) or source.get("status") not in ALLOWED_STATES):
            raise ValueError("Invalid USGS station source state")
        stations[station_id] = {"sourceStatus": source["status"],
                                "sourceSha256": source.get("sourceSha256"),
                                "series": []}

    latest = {}
    if not isinstance(events, list) or receipt.get("eventCount") != len(events):
        raise ValueError("Observation event count differs from bundle receipt")
    for event in events:
        if not isinstance(event, dict):
            raise ValueError("Invalid observation event")
        state, source = event.get("state"), event.get("source")
        if not isinstance(state, dict) or not isinstance(source, dict):
            raise ValueError("Invalid observation metadata")
        station = state.get("sensor_id")
        series = state.get("time_series_id")
        if (station not in stations or
                stations[station]["sourceStatus"] != "CAPTURED" or
                not isinstance(series, str) or not series or
                event.get("matrix") != "O" or event.get("timeline") != "observed" or
                state.get("parameter") != "00065" or state.get("unit") != "ft" or
                state.get("vertical_reference") != "STATION_GAGE_DATUM_UNRESOLVED" or
                source.get("authority") != "USGS" or
                source.get("sha256") != stations[station]["sourceSha256"]):
            raise ValueError("Observation does not match verified station and datum")
        timestamp = _utc(event.get("valid_from"))
        if timestamp > captured_at:
            raise ValueError("Observation timestamp is after capture")
        value = state.get("value")
        if value is not None and (type(value) not in (int, float) or not math.isfinite(value)):
            raise ValueError("Invalid USGS gage-height value")
        identity = (station, series)
        # The preflight rejects duplicate (series, timestamp) identities.
        if identity not in latest or timestamp > latest[identity][0]:
            latest[identity] = (timestamp, event)

    for (station, series), (timestamp, event) in sorted(latest.items()):
        state = event["state"]
        age = (observed_at - timestamp).total_seconds()
        reading_status = ("MISSING_MEASUREMENT" if state.get("value") is None
                          else "STALE" if age > stale_after_seconds
                          else "RECENT_OBSERVATION")
        stations[station]["series"].append({
            "timeSeriesId": series,
            "observedAt": _iso(timestamp),
            "readingStatus": reading_status,
            "ageSeconds": int(age),
            "gageHeightFt": state.get("value"),
            "quality": state.get("quality"),
            "sourceSha256": event["source"]["sha256"],
            "verticalReference": "STATION_GAGE_DATUM_UNRESOLVED",
            "eventId": event["event_id"],
            "geometryWgs84": event.get("geometry"),
        })
    return {
        "schema": SCHEMA,
        "readAt": _iso(observed_at),
        "capturedAt": _iso(captured_at),
        "staleAfterSeconds": stale_after_seconds,
        "observationCount": len(events),
        "navd88WseIncluded": False,
        "hydraulicSimulationIncluded": False,
        "publicPublication": "REVIEW_REQUIRED",
        "engineeringUse": "NOT_VALIDATED",
        "runtime": "FILES_ONLY_NO_SERVER",
        "stations": stations,
    }


def verified_view(directory: Path, *, as_of: str | None = None,
                  stale_after_seconds: int = 3600) -> dict:
    """Verify source bytes and replay before projecting a native-reader view."""
    from .offline_bundle import MAX_EVENTS_BYTES, verify_bundle

    receipt = verify_bundle(directory)
    path = directory / "events.ndjson"
    if path.is_symlink() or not path.is_file():
        raise ValueError("Events must be a regular local file")
    with path.open("rb") as handle:
        raw = handle.read(MAX_EVENTS_BYTES + 1)
    expected = receipt["files"]["events.ndjson"]
    if (len(raw) > MAX_EVENTS_BYTES or len(raw) != expected["size"] or
            hashlib.sha256(raw).hexdigest() != expected["sha256"]):
        raise ValueError("Observation events changed after verification")
    events = [json.loads(line) for line in raw.splitlines()]
    return summarize_observations(receipt, events, as_of=as_of,
                                  stale_after_seconds=stale_after_seconds)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path, help="Previously verified local observation bundle")
    parser.add_argument("--as-of", help="Offset-aware timestamp for deterministic replay")
    parser.add_argument("--stale-after-seconds", type=int, default=3600)
    args = parser.parse_args()
    view = verified_view(args.bundle, as_of=args.as_of,
                         stale_after_seconds=args.stale_after_seconds)
    print(json.dumps(view, sort_keys=True, separators=(",", ":"), allow_nan=False))


if __name__ == "__main__":
    main()
