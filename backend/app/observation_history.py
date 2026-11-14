"""Offline, source-receipted USGS observation history for regional twin references.

Imports a SAVED official OGC Latest Continuous response. Never auto-polls,
accepts MQTT, connects to a broker, or converts gage height to NAVD88.
The per-event hash chain detects changes within this exported file; it is not
a digital signature or an independent USGS observation authentication.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
from pathlib import Path
import re
from urllib.parse import parse_qs, urlsplit

from backend.app.asset_registry import build_registry_snapshot

SCHEMA = "tsm.usgs-stage-history.v1"
MAX_BYTES = 4 * 1024 * 1024
MAX_EVENTS = 10000
STATION = re.compile(r"USGS-[0-9]{8}\Z")
SOURCE_ENDPOINT = "/ogcapi/v1/collections/latest-continuous/items"


class ObservationError(ValueError):
    """Rejected observation source or quality contract."""


def canonical(data: object) -> bytes:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def parse_time(value: object) -> datetime:
    if not isinstance(value, str):
        raise ObservationError("OFFSET_AWARE_TIMESTAMP_REQUIRED")
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ObservationError("INVALID_TIMESTAMP") from exc
    if dt.utcoffset() is None:
        raise ObservationError("OFFSET_AWARE_TIMESTAMP_REQUIRED")
    return dt.astimezone(timezone.utc)


def validate_url(value: str) -> dict[str, str]:
    try:
        url = urlsplit(value)
        port = url.port
        query = parse_qs(url.query, strict_parsing=True)
    except ValueError as exc:
        raise ObservationError("INVALID_USGS_SOURCE_URL") from exc
    if (
        url.scheme != "https" or url.hostname != "api.waterdata.usgs.gov"
        or port is not None or url.username is not None or url.password is not None
        or url.path != SOURCE_ENDPOINT or url.fragment
        or query.get("parameter_code") != ["00065"]
        or len(query.get("monitoring_location_id", [])) != 1
    ):
        raise ObservationError("UNTRUSTED_USGS_SOURCE_URL")
    station = query["monitoring_location_id"][0]
    if not STATION.fullmatch(station):
        raise ObservationError("INVALID_MONITORING_LOCATION")
    return {"station": station, "url": value}


def import_snapshot(
    payload_bytes: bytes,
    registry: dict,
    source_url: str,
    captured_at: str,
    stale_after_minutes: int = 90,
) -> dict:
    if not isinstance(payload_bytes, bytes) or len(payload_bytes) > MAX_BYTES:
        raise ObservationError("SOURCE_TOO_LARGE_OR_INVALID")
    if not isinstance(stale_after_minutes, int) or not 1 <= stale_after_minutes <= 1440:
        raise ObservationError("INVALID_STALENESS_POLICY")
    source = validate_url(source_url)
    captured = parse_time(captured_at)
    try:
        payload = json.loads(payload_bytes)
    except (ValueError, UnicodeError) as exc:
        raise ObservationError("SOURCE_NOT_JSON") from exc
    if not isinstance(payload, dict) or payload.get("type") != "FeatureCollection":
        raise ObservationError("SOURCE_NOT_OGC_FEATURE_COLLECTION")
    features = payload.get("features")
    if not isinstance(features, list) or len(features) > MAX_EVENTS:
        raise ObservationError("UNBOUNDED_OBSERVATION_COUNT")
    assets = registry.get("assets", [])
    if not isinstance(assets, list) or not any(
        isinstance(a, dict) and a.get("assetId") == source["station"] for a in assets
    ):
        raise ObservationError("UNKNOWN_STATION_NOT_IN_SOURCE_BACKED_REGISTRY")
    validated = []
    seen = set()
    for item in features:
        if not isinstance(item, dict) or not isinstance(item.get("properties"), dict):
            raise ObservationError("INVALID_OBSERVATION_FEATURE")
        props = item["properties"]
        if props.get("monitoring_location_id") != source["station"] or props.get("parameter_code") != "00065":
            raise ObservationError("MISMATCHED_STATION_OR_PARAMETER")
        unit = props.get("unit_of_measure")
        if unit != "ft":
            raise ObservationError("UNVERIFIED_STAGE_UNITS")
        raw_value = props.get("value")
        if isinstance(raw_value, bool) or not isinstance(raw_value, (int, float, str)) or (isinstance(raw_value, str) and not raw_value.strip()):
            raise ObservationError("INVALID_STAGE_VALUE")
        try:
            value = float(raw_value)
        except (ValueError, OverflowError) as exc:
            raise ObservationError("INVALID_STAGE_VALUE") from exc
        if not math.isfinite(value):
            raise ObservationError("NONFINITE_STAGE_VALUE")
        observed = parse_time(props.get("time"))
        if observed > captured + timedelta(minutes=5):
            raise ObservationError("OBSERVATION_IN_FUTURE")
        tsid = props.get("timeseries_id")
        if not isinstance(tsid, str) or not (1 <= len(tsid) <= 128):
            raise ObservationError("TIMESERIES_ID_REQUIRED")
        key = (source["station"], tsid, observed.isoformat())
        if key in seen:
            raise ObservationError("DUPLICATE_SOURCE_OBSERVATION")
        seen.add(key)
        approval = props.get("approval_status")
        if not isinstance(approval, (str, list)):
            approval = "UNREPORTED"
        if isinstance(approval, list):
            if not all(isinstance(a, str) and len(a) <= 80 for a in approval):
                raise ObservationError("INVALID_APPROVAL_STATUS")
            approval = ",".join(approval)
        if len(approval) > 160:
            raise ObservationError("INVALID_APPROVAL_STATUS")
        validated.append({
            "assetId": source["station"],
            "parameterCode": "00065",
            "timeseriesId": tsid,
            "observationTime": observed.isoformat().replace("+00:00", "Z"),
            "value": value,
            "unit": "ft",
            "datum": "USGS_STATION_GAGE_DATUM_UNCONVERTED",
            "approvalStatus": approval,
            "dataQuality": "SOURCE_REPORTED_NOT_INDEPENDENTLY_VERIFIED",
        })
    validated.sort(key=lambda x: (x["observationTime"], x["timeseriesId"]))
    prev = "0" * 64
    chain = []
    for event in validated:
        result = {**event, "prevEventSha256": prev}
        prev = hashlib.sha256(canonical(result)).hexdigest()
        chain.append({**result, "eventSha256": prev})
    last = parse_time(validated[-1]["observationTime"]) if validated else None
    age_minutes = (captured - last).total_seconds() / 60 if last else None
    return {
        "schemaVersion": SCHEMA,
        "sourceUrl": source_url,
        "sourceSha256": hashlib.sha256(payload_bytes).hexdigest(),
        "assetRegistrySourceSha256": registry.get("sourceSha256"),
        "capturedAt": captured.isoformat().replace("+00:00", "Z"),
        "stationId": source["station"],
        "parameterCode": "00065",
        "count": len(chain),
        "observations": chain,
        "lastEventSha256": prev,
        "observationState": (
            "SOURCE_UNAVAILABLE" if last is None else
            "STALE" if age_minutes is not None and age_minutes > stale_after_minutes else
            "SOURCE_REPORTED"
        ),
        "staleAfterMinutes": stale_after_minutes,
        "sourceTimestampAgeMinutes": round(age_minutes, 2) if age_minutes is not None else None,
        "stationHealth": "NOT_EVALUATED",
        "navd88WaterSurfaceElevation": None,
        "hydraulicForecast": None,
        "authorityClass": "SOURCE_OBSERVATION",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ogc-response", type=Path, required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--captured-at", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.ogc_response.is_symlink() or not args.ogc_response.is_file():
            raise ObservationError("SOURCE_MUST_BE_REGULAR_FILE")
        if args.ogc_response.stat().st_size > MAX_BYTES:
            raise ObservationError("SOURCE_TOO_LARGE_OR_INVALID")
        registry = build_registry_snapshot()
        output = import_snapshot(args.ogc_response.read_bytes(), registry, args.source_url, args.captured_at)
        if args.output.is_symlink() or args.output.exists() or not args.output.parent.is_dir():
            raise ObservationError("OUTPUT_MUST_BE_NEW_FILE_IN_EXISTING_DIRECTORY")
        with args.output.open("x", encoding="utf-8") as fp:
            json.dump(output, fp, indent=2, sort_keys=True, allow_nan=False)
            fp.write("\n")
    except (ObservationError, OSError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps({"state": output["observationState"], "count": output["count"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
