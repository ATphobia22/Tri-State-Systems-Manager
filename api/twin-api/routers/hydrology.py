from fastapi import APIRouter, Query

from ..services.current import page

router = APIRouter()


@router.get("/twin/current/hydrology")
def current_hydrology(after: str = Query("", max_length=128), limit: int = Query(100, ge=1, le=250),
                      view_version: str | None = Query(None, max_length=90)):
    return page("H", after, limit, view_version=view_version)
