"""Domain validation and Confluent-wire Avro projection."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from fastavro import parse_schema, validation
from jsonschema import Draft202012Validator, FormatChecker

SCHEMAS = Path(__file__).resolve().parents[1] / "schemas"
JSON_SCHEMA = json.loads((SCHEMAS / "state-update.v1.json").read_text())
AVRO_TEXT = (SCHEMAS / "state-update.v1.avsc").read_text()
AVRO = parse_schema(json.loads(AVRO_TEXT))
VALIDATOR = Draft202012Validator(JSON_SCHEMA, format_checker=FormatChecker())


class InvalidEvent(ValueError):
    pass


def canonical(data) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def validate(event: dict) -> None:
    try:
        if len(canonical(event).encode("utf-8")) > 750_000:
            raise InvalidEvent("State event exceeds 750 kB")
    except (ValueError, TypeError, RecursionError) as error:
        raise InvalidEvent(str(error)) from error
    failure = next(VALIDATOR.iter_errors(event), None)
    if failure:
        raise InvalidEvent(f"Invalid state update field: {failure.json_path}")
    if any(item["event_id"] == event["event_id"] for item in event["evidence"]):
        raise InvalidEvent("Evidence cannot reference its own event")


def fingerprint(event: dict) -> str:
    return hashlib.sha256(canonical(event).encode("utf-8")).hexdigest()


def stream_key(event: dict) -> bytes:
    return "/".join(event[name] for name in ("timeline", "branch", "matrix", "entity_id")).encode()


def encode(event: dict) -> dict:
    validate(event)
    record = {k: v for k, v in event.items() if k not in ("geometry", "state")}
    record["geometry_json"] = canonical(event["geometry"]) if event["geometry"] is not None else None
    record["state_json"] = canonical(event["state"])
    validation.validate(record, AVRO, strict=True)
    return record


def decode(record: dict) -> dict:
    if not isinstance(record, dict):
        raise InvalidEvent("Avro value must contain a state update")
    try:
        event = {k: v for k, v in record.items() if k not in ("geometry_json", "state_json")}
        event["geometry"] = json.loads(record["geometry_json"]) if record["geometry_json"] is not None else None
        event["state"] = json.loads(record["state_json"])
    except (KeyError, ValueError, TypeError, RecursionError) as error:
        raise InvalidEvent("Invalid JSON inside Avro record") from error
    validate(event)
    return event
