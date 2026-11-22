"""Read-only infrastructure shell and AAS projection API."""
from uuid import UUID

from fastapi import APIRouter, HTTPException

from twin.asset_shells import export_aas
from twin.read.query import consistent

router = APIRouter()


def get_asset(asset_id: UUID) -> dict:
    with consistent() as conn:
        row = conn.execute("""
            SELECT body FROM read_model.current_entity
            WHERE matrix='I' AND entity_id=%s AND NOT retired
        """, ("infra:" + str(asset_id),)).fetchone()
    if row is None:
        raise HTTPException(404, "No current infrastructure asset with this identity")
    return row["body"]


@router.get("/twin/assets/{asset_id}")
def asset(asset_id: UUID):
    return get_asset(asset_id)


@router.get("/twin/assets/{asset_id}/aas")
def aas(asset_id: UUID):
    try:
        return export_aas(get_asset(asset_id))
    except ValueError as error:
        raise HTTPException(422, f"Asset lacks an AAS-compatible model: {error}") from error


@router.get("/twin/assets/{asset_id}/relationships")
def relationships(asset_id: UUID):
    row = get_asset(asset_id)
    return {"asset_id": str(asset_id), "relationships": row["state"].get("relationships", []),
            "source_event_id": row["event_id"]}
