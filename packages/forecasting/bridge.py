"""Bounded proxy integration to the canonical TSM forecast scripts.

Do not automatically interpret GAGE_DATUM stream stage as NAVD88 WSE.
"""
from __future__ import annotations
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[2]
FORECAST_ROOT = ROOT / "scripts" / "flood-forecasting"

def list_available_forecast_components() -> list[str]:
    return sorted(x.name for x in FORECAST_ROOT.glob("*.py") if x.is_file())

def validate_forecast_evidence(record: dict) -> dict:
    required = ("model_id","source_uri","source_sha256","run_at_utc","input_units","output_units","review_state")
    missing = [key for key in required if not record.get(key)]
    if missing:
        raise ValueError("FORECAST_MISSING_EVIDENCE:" + ",".join(missing))
    if record["review_state"] not in ("NOT_EVALUATED","PENDING_HUMAN_REVIEW","VERIFIED"):
        raise ValueError("FORECAST_INVALID_REVIEW_STATE")
    if record["review_state"] == "VERIFIED":
        raise ValueError("FORECAST_VERIFICATION_REQUIRES_INDEPENDENT_EXTERNAL_REVIEW")
    return {"status": "INFORMATIONAL_FORECAST_NOT_REGULATORY", "model_id": record["model_id"]}
