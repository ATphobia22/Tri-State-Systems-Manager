"""OpenUSD composition helpers for TSM digital twin stages."""

from .variants import (
    HEIGHT_QUALITY_VARIANTS,
    LOD_VARIANTS,
    FLOOD_EVENT_VARIANTS,
    DISPLAY_MODE_VARIANTS,
    validate_variant_selection,
    default_building_variants,
)
from .stage_layout import STAGE_SUBLAYER_ORDER, recommended_root_structure

__all__ = [
    "HEIGHT_QUALITY_VARIANTS",
    "LOD_VARIANTS",
    "FLOOD_EVENT_VARIANTS",
    "DISPLAY_MODE_VARIANTS",
    "validate_variant_selection",
    "default_building_variants",
    "STAGE_SUBLAYER_ORDER",
    "recommended_root_structure",
]
