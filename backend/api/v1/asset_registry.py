"""Public read-only asset and twin discovery over the repo's staged station geometry.

FastAPI is a companion operator process, NOT a GitHub Pages backend.
The public API does not create an instrument, ingest telemetry, or start jobs.
"""
from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, Query

from backend.app.asset_registry import AssetRegistrySourceError, build_registry_snapshot

router = APIRouter(tags=["regional-asset-registry"])
_ASSET_ID = re.compile(r"USGS-[0-9]{8}\Z")


def _snapshot() -> dict:
    try:
        return build_registry_snapshot()
    except AssetRegistrySourceError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "ASSET_SOURCE_UNAVAILABLE",
                "reason": str(exc),
                "dataState": "UNAVAILABLE",
            },
        ) from exc


def _asset(asset_id: str) -> tuple[dict, dict]:
    if not _ASSET_ID.fullmatch(asset_id):
        raise HTTPException(status_code=404, detail={"code": "ASSET_NOT_FOUND"})
    snapshot = _snapshot()
    for item in snapshot["assets"]:
        if item["assetId"] == asset_id:
            return item, snapshot
    raise HTTPException(status_code=404, detail={"code": "ASSET_NOT_FOUND"})


@router.get("/api/assets")
def list_assets(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
) -> dict:
    """Bounded, source-specific asset list. Never claim more than the staged data."""
    snapshot = _snapshot()
    return {
        "schemaVersion": snapshot["schemaVersion"],
        "datasetId": snapshot["datasetId"],
        "sourceSha256": snapshot["sourceSha256"],
        "sourceDeclaredLastReviewedAt": snapshot["sourceDeclaredLastReviewedAt"],
        "authorityLimit": snapshot["authorityLimit"],
        "total": snapshot["count"],
        "offset": offset,
        "limit": limit,
        "assets": snapshot["assets"][offset:offset + limit],
    }


@router.get("/api/assets/{asset_id}")
def get_asset(asset_id: str) -> dict:
    asset, snapshot = _asset(asset_id)
    return {
        "schemaVersion": snapshot["schemaVersion"],
        "sourceSha256": snapshot["sourceSha256"],
        "asset": asset,
    }


@router.get("/api/twins/{asset_id}")
def get_twin(asset_id: str) -> dict:
    """Expose a twin reference only, until actual observation/state evidence exists."""
    asset, snapshot = _asset(asset_id)
    return {
        "schemaVersion": snapshot["schemaVersion"],
        "twinId": asset["assetId"],
        "assetId": asset["assetId"],
        "entityKind": asset["ontologyKind"],
        "sourceDatasetIds": asset["sourceDatasetIds"],
        "sourceSha256": snapshot["sourceSha256"],
        "geometry": asset["geometry"],
        "spatialReference": asset["spatialReference"],
        "stateStatus": "NOT_EVALUATED",
        "currentState": None,
        "observationStatus": "NOT_FETCHED",
        "observations": [],
        "relationships": [],
        "humanAuthorityFinal": True,
        "note": "Station location only. No sensor-health claim, live telemetry, flood forecast, or vertical datum conversion.",
    }
