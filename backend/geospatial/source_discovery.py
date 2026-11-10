"""Read-only upstream-source discovery endpoint; intentionally never downloads data."""
from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/geospatial/source-discovery", tags=["source-discovery"])
REGISTRY_PATH = (Path(__file__).resolve().parents[2] / "data" / "registries" /
                 "tsm-geospatial-upstream-discovery-20261110.json")


def read_catalog(path: Path = REGISTRY_PATH) -> dict[str, Any]:
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 96 * 1024:
        raise ValueError("source-discovery registry missing, symlinked or too large")
    raw = path.read_bytes()
    try:
        catalog = json.loads(raw)
    except (json.JSONDecodeError, UnicodeError) as exc:
        raise ValueError("source-discovery registry JSON invalid") from exc
    if (not isinstance(catalog, dict)
            or catalog.get("schema") != "tsm.geospatial-upstream-discovery.v1"
            or not isinstance(catalog.get("officialDiscoverySources"), list)
            or not isinstance(catalog.get("candidates"), list)):
        raise ValueError("source-discovery registry shape invalid")
    sources = catalog["officialDiscoverySources"]
    if len(sources) > 50 or any(not isinstance(x, dict) or
            not isinstance(x.get("url"), str) or
            not x["url"].startswith("https://") or
            not isinstance(x.get("authority"), str)
            for x in sources):
        raise ValueError("source-discovery records contain invalid references")
    return {"schema": catalog["schema"],
            "status": "DISCOVERY_METADATA_ONLY_NO_FETCH",
            "recordSha256": sha256(raw).hexdigest(),
            "checkedAt": None,  # No live upstream check has been performed here.
            "modelOrRegulatoryValidation": False,
            "officialSources": sources,
            "upstreamCandidates": catalog["candidates"],
            "forkPins": catalog.get("forks", [])}


@router.get("")
def source_discovery() -> dict[str, Any]:
    try:
        return read_catalog()
    except (ValueError, OSError) as exc:
        raise HTTPException(
            503, detail={"code": "GEOSPATIAL_DISCOVERY_CATALOG_UNAVAILABLE",
                         "reason": str(exc)}
        ) from exc
