"""Geometry-indexed, source-traceable links to terrain, parcel and 3D assets.

Only geometry already in EPSG:4326 is accepted. Transformations must be
performed and independently documented upstream; this code never silently
transforms local grid values or manufactures engineering authority.
"""
from __future__ import annotations

import math
from uuid import NAMESPACE_URL, UUID, uuid5

from .contracts import canonical, validate

LAYER_KINDS = frozenset({"terrain", "building", "floodplain", "parcel", "3d_tiles"})
ACCEPTED_STATUSES = frozenset({"UNVERIFIED", "REVIEWED"})


def _walk_coordinates(value):
    if isinstance(value, (tuple, list)) and value and isinstance(value[0], (int, float)):
        if len(value) not in (2, 3) or any(isinstance(v, bool) or not isinstance(v, (int, float))
                                        or not math.isfinite(v) for v in value):
            raise ValueError("Position must contain 2–3 finite numeric coordinates")
        lon, lat = value[:2]
        if not -180 <= lon <= 180 or not -90 <= lat <= 90:
            raise ValueError("Geometry outside EPSG:4326 longitude/latitude range")
        yield (lon, lat)
    elif isinstance(value, (tuple, list)) and value:
        for item in value:
            yield from _walk_coordinates(item)
    else:
        raise ValueError("Empty or malformed GeoJSON coordinates")


def make_link_event(*, layer_kind: str, source_feature_id: str, source: dict,
                    valid_from: str, geometry: dict, source_horizontal_crs: str,
                    coordinate_status: str = "UNVERIFIED",
                    transformation_evidence_sha256: str | None = None,
                    vertical_datum: str = "UNKNOWN", vertical_unit: str = "UNKNOWN",
                    artifact: dict | None = None, upstream_event_ids: list[str] | None = None,
                    feature_metadata: dict | None = None, version: int = 1) -> dict:
    """Create deterministic matrix-E spatial linkage; publisher calls twin.store.apply.

    source_feature_id is the authoritative identifier, not a tessellation
    index; 3D Tiles feature linkage must be independently tested against that ID.
    """
    if layer_kind not in LAYER_KINDS:
        raise ValueError("Unsupported geospatial layer")
    if not isinstance(source_feature_id, str) or not (1 <= len(source_feature_id) <= 128):
        raise ValueError("source_feature_id must be a nonempty string <=128 characters")
    if not isinstance(version, int) or isinstance(version, bool) or version < 1:
        raise ValueError("Version must be positive integer")
    if not isinstance(source_horizontal_crs, str) or not source_horizontal_crs.strip():
        raise ValueError("Source horizontal CRS must be recorded")
    if coordinate_status not in ACCEPTED_STATUSES:
        raise ValueError("Coordinate status must be REVIEWED or UNVERIFIED")
    if coordinate_status == "REVIEWED" and (
        not isinstance(transformation_evidence_sha256, str)
        or len(transformation_evidence_sha256) != 64
        or any(c not in "0123456789abcdef" for c in transformation_evidence_sha256)
    ):
        raise ValueError("Reviewed coordinates require a pinned transformation evidence SHA-256")
    if not isinstance(vertical_datum, str) or not vertical_datum.strip():
        raise ValueError("Vertical datum label required; use UNKNOWN when unresolved")
    if not isinstance(vertical_unit, str) or not vertical_unit.strip():
        raise ValueError("Vertical unit label required; use UNKNOWN when unresolved")
    if not isinstance(geometry, dict) or geometry.get("type") not in (
        "Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon"
    ):
        raise ValueError("Spatial link requires supported GeoJSON geometry")
    positions = list(_walk_coordinates(geometry.get("coordinates")))
    if not positions:
        raise ValueError("Spatial link geometry must have coordinates")
    if len(positions) > 50000:
        raise ValueError("Spatial link geometry exceeds the 50,000 vertex bound")
    if feature_metadata is None:
        feature_metadata = {}
    if not isinstance(feature_metadata, dict) or len(feature_metadata) > 24:
        raise ValueError("Feature metadata must have <=24 members")
    upstream = upstream_event_ids if upstream_event_ids is not None else []
    if not isinstance(upstream, list) or len(upstream) > 64:
        raise ValueError("At most 64 upstream evidence event IDs")
    references = sorted({str(UUID(str(value))) for value in upstream})
    if len(references) != len(upstream):
        raise ValueError("Duplicate upstream evidence IDs")
    if not isinstance(source, dict) or not isinstance(source.get("authority"), str):
        raise ValueError("Authoritative source must be a provenance object")
    identity = {"kind": layer_kind, "feature": source_feature_id,
                "authority": source["authority"]}
    entity_id = "geo:" + uuid5(NAMESPACE_URL, canonical(identity)).hex
    state = {
        "geo_layer_kind": layer_kind, "source_feature_id": source_feature_id,
        "source_horizontal_crs": source_horizontal_crs, "footprint_crs": "EPSG:4326",
        "coordinate_status": coordinate_status,
        "transformation_evidence_sha256": transformation_evidence_sha256,
        "vertical_datum": vertical_datum, "vertical_unit": vertical_unit,
        "feature_metadata": feature_metadata, "version": version,
        "upstream_link_status": "EVENT_LINKED" if references else "UNRESOLVED",
        "licensing_review": "NOT_REVIEWED",
    }
    payload = {"version": 1, "matrix": "E", "entity_id": entity_id, "timeline": "observed",
               "branch": "main", "valid_from": valid_from, "operation": "upsert",
               "geometry": geometry, "state": state, "source": source,
               "asset": artifact, "evidence": [{"event_id": value, "relationship": "derived_from"}
                                              for value in references]}
    event = {"event_id": str(uuid5(NAMESPACE_URL, canonical(payload))), **payload}
    validate(event)
    return event
