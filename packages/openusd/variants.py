"""OpenUSD asset variant catalogs and gates for TSM."""

from __future__ import annotations

from typing import Final

HEIGHT_QUALITY_VARIANTS: Final[tuple[str, ...]] = (
    "OBSERVED",
    "DERIVED",
    "UNAVAILABLE",
)

LOD_VARIANTS: Final[tuple[str, ...]] = ("LOD0", "LOD1", "LOD2")

FLOOD_EVENT_VARIANTS: Final[tuple[str, ...]] = (
    "none",
    "1913",
    "1937",
    "2008",
    "2011",
    "custom",
)

DISPLAY_MODE_VARIANTS: Final[tuple[str, ...]] = ("engineering", "cinematic")

SOURCE_AUTHORITY_VARIANTS: Final[tuple[str, ...]] = (
    "FIRM",
    "survey",
    "model",
    "demo",
)

_ALLOWED: Final[dict[str, tuple[str, ...]]] = {
    "heightQuality": HEIGHT_QUALITY_VARIANTS,
    "lod": LOD_VARIANTS,
    "floodEvent": FLOOD_EVENT_VARIANTS,
    "displayMode": DISPLAY_MODE_VARIANTS,
    "sourceAuthority": SOURCE_AUTHORITY_VARIANTS,
}


def validate_variant_selection(set_name: str, choice: str) -> bool:
    """Return True if choice is a registered option for set_name."""
    allowed = _ALLOWED.get(set_name)
    if allowed is None:
        return False
    return choice in allowed


def default_building_variants() -> dict[str, str]:
    """Safe defaults: no invented heights, engineering mode."""
    return {
        "heightQuality": "DERIVED",
        "lod": "LOD1",
        "displayMode": "engineering",
        "sourceAuthority": "model",
    }


def gates_for_selection(variants: dict[str, str]) -> dict[str, bool]:
    """
    Release-style gates derived from variant picks.
    True means the action is allowed.
    """
    hq = variants.get("heightQuality", "UNAVAILABLE")
    mode = variants.get("displayMode", "engineering")
    auth = variants.get("sourceAuthority", "demo")
    return {
        "allow_freeboard_from_prim": hq in ("OBSERVED", "DERIVED"),
        "require_simulation_demo_banner": mode == "cinematic" or auth == "demo",
        "allow_loma_package_claim": auth in ("FIRM", "survey") and hq == "OBSERVED",
        "allow_numeric_bfe_delta": hq != "UNAVAILABLE",
    }
