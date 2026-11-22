"""Operator CLI: compare two stored events and commit evidence-linked V revision.

Example:
  python -m twin.validate_hydrology --observation UUID --prediction UUID \
    --gage-zero ./reviewed-gage-zero.json --validated-at 2026-11-22T07:00:00Z
A missing or unreviewed datum prints WITHHELD and does not write a validation.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from uuid import UUID

from .hydrology_validation import VALIDATED, compare, validation_event
from .store import apply, connect


def _read_record(event_id):
    with connect() as conn:
        row = conn.execute("SELECT body FROM twin.event WHERE event_id=%s",
                           (str(UUID(event_id)),)).fetchone()
    if row is None:
        raise ValueError("No such canonical twin event")
    return row["body"]


def run(observation_id, prediction_id, *, gage_zero=None, max_skew_seconds=0,
        validated_at=None, observation_use="unknown"):
    observation, prediction = _read_record(observation_id), _read_record(prediction_id)
    result = compare(observation, prediction, gage_zero=gage_zero,
                     max_skew_seconds=max_skew_seconds)
    if result["status"] != VALIDATED:
        return result
    validated_at = validated_at or datetime.now(timezone.utc).isoformat()
    event = validation_event(observation, prediction, result, validated_at=validated_at,
                             observation_use=observation_use)
    seq, inserted = apply(event)
    return {**result, "validation_event_id": event["event_id"],
            "commit_sequence": seq, "inserted": inserted}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--observation", required=True, help="Stored matrix-O event UUID")
    parser.add_argument("--prediction", required=True, help="Stored matrix-H model event UUID")
    parser.add_argument("--gage-zero", type=Path, help="Reviewed station-specific NAVD88 gage-zero JSON")
    parser.add_argument("--validated-at", help="UTC timestamp, fixed for idempotent replay")
    parser.add_argument("--max-skew-seconds", type=int, default=0)
    parser.add_argument("--observation-use", choices=["unknown", "fit", "withheld"], default="unknown")
    options = parser.parse_args()
    datum = None
    if options.gage_zero:
        if options.gage_zero.stat().st_size > 65536:
            parser.error("Gage-zero evidence document too large")
        datum = json.loads(options.gage_zero.read_text(encoding="utf-8"))
    result = run(options.observation, options.prediction, gage_zero=datum,
                 validated_at=options.validated_at, max_skew_seconds=options.max_skew_seconds,
                 observation_use=options.observation_use)
    print(json.dumps(result, sort_keys=True, allow_nan=False))
    if result["status"] != VALIDATED:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
