"""Source-native live hydrology fabric gateway. Synthetic fallback is prohibited."""
from __future__ import annotations
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote
import httpx

@dataclass(frozen=True)
class LiveSourceRecord:
    source_id: str
    authority_class: str
    endpoint: str
    retrieved_at_epoch: float
    source_timestamp: str | None
    payload: Any

class LiveFabricError(RuntimeError):
    pass

async def fetch_nwps_stageflow(gauge_id: str, *, timeout_seconds: float = 15.0) -> LiveSourceRecord:
    if not gauge_id or any(ch.isspace() for ch in gauge_id):
        raise ValueError("gauge_id must be a non-empty source identifier")
    endpoint = "https://api.water.noaa.gov/nwps/v1/gauges/" + quote(gauge_id, safe="") + "/stageflow"
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.get(endpoint, headers={"Accept": "application/json"})
        response.raise_for_status()
        payload = response.json()
    return LiveSourceRecord("NOAA_NWPS","OBSERVATION_AND_FORECAST",endpoint,time.time(),_source_timestamp(payload),payload)

def _source_timestamp(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    for key in ("timestamp","validTime","valid_time","observedTime"):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value
    return None
