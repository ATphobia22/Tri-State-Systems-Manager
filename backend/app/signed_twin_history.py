"""Bounded HMAC-verified telemetry -> SQLite append-only *candidate* twin history.

Application-layer primitive only: no HTTP, TLS termination, MQTT broker,
public API, device onboarding, AWS credentials, or claims of official USGS data.
A production ingress must independently enforce TLS 1.2+, identity lifecycle,
network rate limits, secret rotation, least privilege, and external audit anchors.

One externally reviewed device->station enrollment (and its private secret)
is required. Observations use the original gage datum, never NAVD88.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import hmac
import json
import math
from pathlib import Path
import re
import sqlite3

MAX_EVENT_BYTES = 8192
MAX_CLOCK_SKEW_SECONDS = 300
PARAMETER = "00065"
SCHEMA = "tsm.signed-sensor-event.v1"
DEVICE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{1,80}\Z")
EVENT = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}\Z")
SHA = re.compile(r"sha256=[0-9a-f]{64}\Z")


class IngestError(ValueError):
    """Authentication, replay or data-contract rejection."""


def parse_time(raw: object) -> datetime:
    if not isinstance(raw, str):
        raise IngestError("OFFSET_TIMESTAMP_REQUIRED")
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise IngestError("INVALID_TIMESTAMP") from exc
    if dt.utcoffset() is None:
        raise IngestError("OFFSET_TIMESTAMP_REQUIRED")
    return dt.astimezone(timezone.utc)


def verify_and_decode(
    payload: bytes,
    signature: str,
    secrets: dict[str, bytes],
    enrollment: dict[str, str],
    asset_ids: set[str],
    received_at: datetime,
) -> dict:
    if not isinstance(payload, bytes) or not 0 < len(payload) <= MAX_EVENT_BYTES:
        raise IngestError("INVALID_SIZE")
    if not isinstance(signature, str) or not SHA.fullmatch(signature):
        raise IngestError("BAD_AUTHENTICATION")
    try:
        obj = json.loads(payload)
    except (ValueError, UnicodeError) as exc:
        raise IngestError("INVALID_JSON") from exc
    if not isinstance(obj, dict) or obj.get("schemaVersion") != SCHEMA:
        raise IngestError("INVALID_SENSOR_EVENT_SCHEMA")
    device = obj.get("deviceId")
    event_id = obj.get("eventId")
    if not isinstance(device, str) or not DEVICE.fullmatch(device):
        raise IngestError("INVALID_DEVICE_ID")
    if not isinstance(event_id, str) or not EVENT.fullmatch(event_id):
        raise IngestError("INVALID_EVENT_ID")
    key = secrets.get(device)
    if not isinstance(key, bytes) or len(key) < 32:
        raise IngestError("BAD_AUTHENTICATION")
    expected = "sha256=" + hmac.new(key, payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise IngestError("BAD_AUTHENTICATION")
    asset_id = enrollment.get(device)
    if not asset_id or obj.get("assetId") != asset_id or asset_id not in asset_ids:
        raise IngestError("DEVICE_ASSET_ENROLLMENT_MISMATCH")
    if obj.get("parameterCode") != PARAMETER or obj.get("unit") != "ft":
        raise IngestError("PARAMETER_OR_UNIT_MISMATCH")
    if obj.get("datum") != "USGS_STATION_GAGE_DATUM_UNCONVERTED":
        raise IngestError("DATUM_NOT_RESOLVED")
    value = obj.get("value")
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise IngestError("INVALID_VALUE")
    try:
        v = float(value)
    except (OverflowError, ValueError) as exc:
        raise IngestError("INVALID_VALUE") from exc
    if not math.isfinite(v):
        raise IngestError("INVALID_VALUE")
    sent = parse_time(obj.get("sentAt"))
    observed = parse_time(obj.get("observedAt"))
    received = received_at.astimezone(timezone.utc)
    if abs((sent - received).total_seconds()) > MAX_CLOCK_SKEW_SECONDS:
        raise IngestError("EXPIRED_OR_FUTURE_SIGNED_EVENT")
    if observed > received.replace(microsecond=received.microsecond) and (observed - received).total_seconds() > MAX_CLOCK_SKEW_SECONDS:
        raise IngestError("FUTURE_OBSERVATION")
    return {
        "eventId": event_id,
        "deviceId": device,
        "assetId": asset_id,
        "parameterCode": PARAMETER,
        "observedAt": observed.isoformat().replace("+00:00", "Z"),
        "sentAt": sent.isoformat().replace("+00:00", "Z"),
        "receivedAt": received.isoformat().replace("+00:00", "Z"),
        "value": v,
        "unit": "ft",
        "datum": "USGS_STATION_GAGE_DATUM_UNCONVERTED",
        "sourceClass": "DEVICE_SIGNED_NOT_OFFICIAL_USGS",
        "sourcePayloadSha256": hashlib.sha256(payload).hexdigest(),
        "navd88WaterSurfaceElevation": None,
        "forecastState": "NOT_EVALUATED",
    }


def initialize(db: sqlite3.Connection) -> None:
    db.execute("PRAGMA foreign_keys = ON")
    db.execute("PRAGMA synchronous = FULL")
    db.execute(
        "CREATE TABLE IF NOT EXISTS signed_twin_events ("
        " seq INTEGER PRIMARY KEY AUTOINCREMENT,"
        " event_id TEXT NOT NULL UNIQUE, device_id TEXT NOT NULL,"
        " asset_id TEXT NOT NULL, observed_at TEXT NOT NULL,"
        " event_json TEXT NOT NULL, previous_hash TEXT NOT NULL,"
        " event_hash TEXT NOT NULL UNIQUE)"
    )
    db.execute("CREATE INDEX IF NOT EXISTS idx_twin_asset_time "
               "ON signed_twin_events(asset_id, observed_at)")
    db.commit()


def append_signed_event(
    db: sqlite3.Connection,
    payload: bytes,
    signature: str,
    secrets: dict[str, bytes],
    enrollment: dict[str, str],
    registry: dict,
    received_at: datetime,
) -> dict:
    asset_ids = {a["assetId"] for a in registry.get("assets", [])
                 if isinstance(a, dict) and isinstance(a.get("assetId"), str)}
    verified = verify_and_decode(payload, signature, secrets, enrollment, asset_ids, received_at)
    initialize(db)
    serialized = json.dumps(verified, sort_keys=True, separators=(",", ":"), allow_nan=False)
    try:
        db.execute("BEGIN IMMEDIATE")
        prior = db.execute("SELECT event_hash FROM signed_twin_events ORDER BY seq DESC LIMIT 1").fetchone()
        prev_hash = prior[0] if prior else "0" * 64
        event_hash = hashlib.sha256((prev_hash + serialized).encode("utf-8")).hexdigest()
        db.execute(
            "INSERT INTO signed_twin_events(event_id, device_id, asset_id, observed_at, event_json, previous_hash, event_hash) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (verified["eventId"], verified["deviceId"], verified["assetId"],
             verified["observedAt"], serialized, prev_hash, event_hash),
        )
        db.commit()
    except sqlite3.IntegrityError as exc:
        db.rollback()
        raise IngestError("REPLAYED_EVENT_ID") from exc
    except sqlite3.Error:
        db.rollback()
        raise
    return {"eventId": verified["eventId"], "assetId": verified["assetId"], "eventHash": event_hash,
            "observationState": "SIGNED_DEVICE_CANDIDATE_NOT_USGS"}


def read_history(db: sqlite3.Connection, asset_id: str, limit: int = 500) -> list[dict]:
    if not isinstance(asset_id, str) or not DEVICE.fullmatch(asset_id):
        raise IngestError("INVALID_ASSET")
    if not isinstance(limit, int) or not 1 <= limit <= 500:
        raise IngestError("INVALID_LIMIT")
    return [
        {**json.loads(row[0]), "previousEventHash": row[1], "eventHash": row[2]}
        for row in db.execute(
            "SELECT event_json, previous_hash, event_hash FROM signed_twin_events "
            "WHERE asset_id=? ORDER BY observed_at DESC, seq DESC LIMIT ?", (asset_id, limit))
    ]


def verify_history_chain(db: sqlite3.Connection) -> bool:
    prev = "0" * 64
    for serialized, recorded_prev, recorded_hash in db.execute(
        "SELECT event_json, previous_hash, event_hash FROM signed_twin_events ORDER BY seq"
    ):
        if prev != recorded_prev:
            return False
        h = hashlib.sha256((prev + serialized).encode("utf-8")).hexdigest()
        if not hmac.compare_digest(h, recorded_hash):
            return False
        prev = h
    return True
