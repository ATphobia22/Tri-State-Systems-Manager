from fastapi import APIRouter, Query

from ..services.current import page, parse_bounds

router = APIRouter()


@router.get("/twin/current/terrain")
def current_terrain(after: str = Query("", max_length=128), limit: int = Query(100, ge=1, le=250),
                    bbox: str | None = Query(None, max_length=128),
                    view_version: str | None = Query(None, max_length=90)):
    return page("T", after, limit, bbox=parse_bounds(bbox), view_version=view_version)
