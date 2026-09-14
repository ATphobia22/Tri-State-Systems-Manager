"""BFE evidence model; distinguishes authoritative source values from derived values."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import hashlib
import json
import math


@dataclass(frozen=True)
class BfeEvidence:
    source_authority: str
    service_url: str
    layer_id: str
    feature_id: str
    panel_id: str | None
    effective_date: str | None
    retrieved_at: str
    bfe_ft: float
    horizontal_crs: str
    vertical_datum: str
    source_status: str
    content_hash_sha256: str


def build_bfe_evidence(*, source_authority: str, service_url: str, layer_id: str, feature_id: str, bfe_ft: float, horizontal_crs: str, vertical_datum: str, panel_id: str | None = None, effective_date: str | None = None, source_status: str = "CURRENT", retrieved_at: str | None = None, raw_feature: object | None = None) -> BfeEvidence:
    if not source_authority or not service_url or not layer_id or not feature_id:
        raise ValueError("BFE source identity is required")
    if not all(isinstance(value, str) and value.strip() for value in (horizontal_crs, vertical_datum, source_status)):
        raise ValueError("BFE CRS, vertical datum, and source status are required")
    if not isinstance(bfe_ft, (int, float)) or not math.isfinite(float(bfe_ft)):
        raise ValueError("BFE must be finite")
    timestamp = retrieved_at or datetime.now().astimezone().isoformat()
    payload = {
        "source_authority": source_authority, "service_url": service_url, "layer_id": layer_id,
        "feature_id": feature_id, "panel_id": panel_id, "effective_date": effective_date,
        "bfe_ft": float(bfe_ft), "horizontal_crs": horizontal_crs, "vertical_datum": vertical_datum,
        "source_status": source_status, "retrieved_at": timestamp, "raw_feature": raw_feature,
    }
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()
    return BfeEvidence(source_authority, service_url, layer_id, feature_id, panel_id, effective_date, timestamp, float(bfe_ft), horizontal_crs, vertical_datum, source_status, digest)
