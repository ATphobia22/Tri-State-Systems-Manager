"""Recommended OpenUSD stage sublayer order for Tri-State twin."""

from __future__ import annotations

from typing import Final

# Relative paths under a stages/ directory; stronger session overrides last if desired.
STAGE_SUBLAYER_ORDER: Final[tuple[str, ...]] = (
    "00_geospatial.usda",
    "10_terrain.usda",
    "20_buildings.usda",
    "30_hydro_live.usda",
    "40_flood_history.usda",
    "50_evidence.usda",
    "90_cinematic.usda",
)


def recommended_root_structure() -> dict:
    """Machine-readable stage recipe for tooling / UE / Omniverse bridges."""
    return {
        "root": "root.usda",
        "sublayers": list(STAGE_SUBLAYER_ORDER),
        "variant_sets_on_buildings": ["heightQuality", "lod", "displayMode"],
        "variant_sets_on_flood": ["floodEvent"],
        "payload_policy": "defer_county_geometry",
        "evidence_plane": "metadata_only",
        "human_authority": True,
    }
