"""Deterministic, offline-only incident exposure screening.

A feature count/intersection is a *screening observation*, never a
flood depth, damage estimate, evacuation order, FIRM or survey conclusion.
Consumes ONLY previously approved SHA-256-verified local incident layers.
"""
from __future__ import annotations

from collections import Counter
from typing import Any

from backend.geospatial.incident_layers import (
    IncidentLayerError, incident_root, load_incident_geojson, _manifest,
)


class ExposureScreeningError(ValueError):
    pass


def _shape(geometry: dict[str, Any]):
    try:
        from shapely.geometry import shape
    except ImportError as exc:
        raise ExposureScreeningError("Shapely is required for spatial screening") from exc
    result = shape(geometry)
    if result.is_empty or not result.is_valid:
        raise ExposureScreeningError("invalid or empty geometry; no automatic repairs")
    return result


def screen_local_exposure(
    hazard_layer_id: str,
    asset_layer_id: str,
    *,
    root=None,
    max_pairs: int = 1_000_000,
) -> dict[str, Any]:
    """Count features intersecting an operator-reviewed hazard polygon layer.

    Coordinates are EPSG:4326. Uses topology only; does NOT calculate areas,
    lengths, distances, probabilities, water surface elevations or damage.
    A bounding-box overlap is not counted unless exact intersection succeeds.
    """
    base = root or incident_root()
    if hazard_layer_id == asset_layer_id:
        raise ExposureScreeningError("hazard and asset layer IDs must differ")
    rows = {x["id"]: x for x in _manifest(base)}
    if hazard_layer_id not in rows or asset_layer_id not in rows:
        raise ExposureScreeningError("both local layers must be explicitly staged and reviewed")
    hazard_meta, asset_meta = rows[hazard_layer_id], rows[asset_layer_id]
    if hazard_meta["style"] != "fill":
        raise ExposureScreeningError("hazard screening requires a reviewed polygon layer")
    if asset_meta["authority_class"] == "DERIVED" and hazard_meta["authority_class"] == "DERIVED":
        raise ExposureScreeningError("cannot infer exposure solely from two derived sources")
    hazards = load_incident_geojson(hazard_layer_id, base)
    assets = load_incident_geojson(asset_layer_id, base)
    hazard_features = hazards["features"]
    asset_features = assets["features"]
    if len(hazard_features) * len(asset_features) > max_pairs:
        raise ExposureScreeningError("pair budget exceeded; use tiled/spatial-index batch process")
    hazard_shapes = [_shape(f["geometry"]) for f in hazard_features]
    asset_shapes = [_shape(f["geometry"]) for f in asset_features]
    # Per-feature counts, not intersecting pair counts: an asset that intersects
    # two hazard polygons is still ONE screened asset.
    touched = [any(a.intersects(h) for h in hazard_shapes) for a in asset_shapes]
    intersecting = sum(touched)
    return {
        "schema": "tsm.offline-exposure-screen.v1",
        "state": "PROVISIONAL_TOPOLOGICAL_SCREEN",
        "hazardLayer": hazard_layer_id,
        "assetLayer": asset_layer_id,
        "hazardFeatureCount": len(hazard_shapes),
        "assetFeatureCount": len(asset_shapes),
        "assetFeaturesIntersecting": intersecting,
        "assetFeaturesNotIntersecting": len(asset_shapes) - intersecting,
        "hazardSha256": hazards["_tsm"]["source_sha256"],
        "assetSha256": assets["_tsm"]["source_sha256"],
        "crs": "EPSG:4326",
        "horizontalDatumSourceVerified": False,
        "verticalDatum": None,
        "estimatedFloodDepth": None,
        "estimatedDamage": None,
        "estimatedFloodProbability": None,
        "femaRegulatoryDetermination": False,
        "surveyCertification": False,
        "humanReviewRequired": True,
        "limitations": (
            "Feature intersection only; neither FEMA effective flood zone "
            "nor inundation depth, exposure probability, damage, loss, "
            "parcel ownership, elevation or risk is determined. "
            "Source geometry and effective-date applicability require review."
        ),
    }
