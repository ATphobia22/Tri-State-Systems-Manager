"""Release gates bound to OpenUSD variant selections."""

from __future__ import annotations

from packages.openusd.variants import gates_for_selection, validate_variant_selection


def evaluate_usd_display_gates(variants: dict[str, str]) -> list[str]:
    """
    Return list of soft-label messages (never hard-stop the twin).
    Aligns with TSM soft-label policy.
    """
    msgs: list[str] = []
    for k, v in variants.items():
        if not validate_variant_selection(k, v):
            msgs.append(f"UNKNOWN_VARIANT:{k}={v}")
    g = gates_for_selection(variants)
    if g["require_simulation_demo_banner"]:
        msgs.append("SIMULATION_DEMO")
    if not g["allow_freeboard_from_prim"]:
        msgs.append("HEIGHT_UNAVAILABLE_NO_FREEBOARD")
    if not g["allow_loma_package_claim"]:
        msgs.append("LOMA_CLAIM_BLOCKED_NEED_SURVEY_OR_FIRM")
    return msgs
