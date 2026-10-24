"""Verified site constants for the Tri-State Systems Manager reference site.

These values are the corrected record. They override any pasted or legacy
material that disagrees:

- Regulatory BFE = 369.1 ft NAVD88, verified against FEMA FIS 18129CV000A
  Table 9 section A (RM 844.75), Indiana DNR cross-sections, and the FIRMette.
  The 375.0 ft figure that appears in pasted other-AI material is WRONG and
  must never be used as the site BFE.
- LAG 377.2 ft NAVD88 is OWNER-CLAIMED, not a certified survey elevation.
  It is recorded here as a claim with that label, never as a survey fact.
- FFE 382.5 ft is UNVERIFIED (its only source is a document built on invented
  values). It is deliberately NOT defined here; any code that needs a first
  floor elevation must obtain it from a certified elevation certificate.
- Correct freeboard of claimed LAG above corrected BFE: 377.2 - 369.1 = +8.1 ft.

Gage datums below are the parent-verified datum table (2026-10-24). NOTE on a
known discrepancy: tsm-console/src/lib/gage-datums.ts (2026-10-15) records a
352.67 ft CANDIDATE gage-zero relationship for 03378500 from USGS SIR
2016-5119 with an unclosed product-semantic conflict and marks conversion
unpublished. The 352.71 ft value used here is the parent-verified datum; the
discrepancy is flagged for reconciliation and the TS file's caution is NOT
silently overwritten. Until reconciliation, treat WSE conversions from this
table as verified-datum conversions, not as published product conversions.
"""

from __future__ import annotations

from typing import Final

# Regulatory Base Flood Elevation, ft NAVD88 (FEMA FIS 18129CV000A Table 9 §A).
REGULATORY_BFE_FT_NAVD88: Final = 369.1

# Owner-claimed Lowest Adjacent Grade, ft NAVD88 — NOT a certified survey.
OWNER_CLAIMED_LAG_FT_NAVD88: Final = 377.2

# Derived freeboard of claimed LAG above corrected BFE, ft (rounded: raw
# float subtraction gives 8.099999999999966).
CLAIMED_FREEBOARD_FT: Final = round(
    OWNER_CLAIMED_LAG_FT_NAVD88 - REGULATORY_BFE_FT_NAVD88, 3)  # 8.1

# FFE is intentionally absent: 382.5 ft is UNVERIFIED. Do not add it here
# without a certified elevation certificate as source.

# Verified gage datums, ft NAVD88: station id -> (station name, gage datum).
# WSE = stage + gage datum ONLY after both datums are validated; otherwise
# the conversion module returns UNAVAILABLE, never an estimate.
GAGE_DATUMS_FT_NAVD88: Final[dict[str, tuple[str, float]]] = {
    "03378500": ("Wabash River at New Harmony, IN", 352.71),
    "03381700": ("Ohio River at Old Shawneetown, IL", 309.10),
    "03322000": ("Ohio River at Evansville, IN", 328.32),
    "03304300": ("Ohio River at Newburgh, IN", 329.20),
    "03377500": ("Wabash River at Mt. Carmel, IL", 368.98),
}

# Horizontal reference for the tri-state site work (kept for documentation;
# code that needs a CRS must still pass it explicitly, never assume it).
SITE_HORIZONTAL_CRS: Final = "EPSG:2966"  # NAD83 / Indiana West, US survey feet
SITE_VERTICAL_DATUM: Final = "NAVD88"
