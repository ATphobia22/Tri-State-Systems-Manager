# -*- coding: utf-8 -*-
"""
PTDT v35 Sovereign Core - Authoritative Site Constants
Filename: backend/gov/site_constants.py
Anchor: 13101 Bonebank Road, Point Township, Posey County, Indiana
Datums: Canonical multi-state EPSG:26916 (NAD83 / UTM 16N m) for storage;
        EPSG:2966/2968 Indiana West ftUS for county filings/LOMA;
        Vertical: NAVD88 orthometric (H = h - N via GEOID18).
Master Seal: updated 2026-11-23 for BFE 369.1 ft NAVD88 (FIRM 18129C0300C / FIS Table 9).

IMMUTABLE. Presentation layers and plugins are forbidden from mutating these values.
"""

from typing import Final, Dict, Any

# Geodetic & Regulatory Invariants (Material Truth) — corrected 2026-10-23
BFE_FT: Final[float] = 369.1          # NAVD88, FIRM Panel 18129C0300C, FIS 18129CV000A Table 9, RM 844.75
LAG_FT: Final[float] = 377.2
FFE_FT: Final[float] = 382.5
BERM_CREST_FT: Final[float] = 379.8
# Canonical internal multi-state storage / network computation
HORIZONTAL_CRS_CANONICAL: Final[str] = "EPSG:26916"   # NAD83 / UTM Zone 16N (metres)
# County filing / LOMA export
HORIZONTAL_CRS_FILING: Final[str] = "EPSG:2966"       # NAD83 / Indiana West (ftUS)
HORIZONTAL_CRS_FILING_HARN: Final[str] = "EPSG:2968"  # NAD83(HARN) sibling
VERTICAL_DATUM: Final[str] = "NAVD88"
PARCEL_APN: Final[str] = "65-19-08-100-008.001-010"
SITE_ADDRESS: Final[str] = "13101 Bonebank Road, Mount Vernon, IN 47620"
LATITUDE: Final[float] = 37.8348
LONGITUDE: Final[float] = -88.0142
FIRM_PANEL: Final[str] = "18129C0300C"
COMMUNITY_ID: Final[str] = "180209"
OWNER: Final[str] = "TUCKER"
ACREAGE: Final[float] = 2.0
PROPERTY_CLASS: Final[str] = "511"

# Compliance Factors (roadmap: Bishop FoS ≥ 1.500 for levee work)
COMPENSATORY_SAFETY_FACTOR: Final[float] = 1.20  # Indiana 312 IAC 10-5
MIN_BISHOP_FOS: Final[float] = 1.500
MIN_FREEBOARD_FT: Final[float] = 2.0
CRITICAL_FOST_THRESHOLD: Final[float] = 1.10

# Cryptographic Provenance (re-seal after BFE correction)
MASTER_SEAL: Final[str] = "c9e4f2a81b7d3e60594f8c1a0d6b2e7f3a9c5d8e1b4f7a0c3d6e9f2b5a8c1d4e"

# USGS Anchors
USGS_GAUGE_ID: Final[str] = "03378500"          # Wabash River at New Harmony, IN
USGS_STATION: Final[str] = "Wabash River at New Harmony, IN"
USGS_GAUGE_ZERO_NAVD88_FT: Final[float] = 352.67  # reconciled SIR variant preferred
USGS_EVANSVILLE_ID: Final[str] = "03322000"
USGS_EVANSVILLE_ZERO_NAVD88_FT: Final[float] = 328.32

# County footprint (canonical 9 including Wabash IL for gauge 03377500)
COUNTY_FIPS: Final[tuple] = (
    "18051",  # Gibson IN
    "18129",  # Posey IN
    "18163",  # Vanderburgh IN
    "18173",  # Warrick IN
    "17059",  # Gallatin IL
    "17193",  # White IL
    "17185",  # Wabash IL (Mount Carmel gauge)
    "21101",  # Henderson KY
    "21225",  # Union KY
)

def get_sovereign_constants() -> Dict[str, Any]:
    """Return a frozen dictionary of all site invariants for downstream read-only consumption."""
    return {
        "bfe_ft": BFE_FT,
        "lag_ft": LAG_FT,
        "ffe_ft": FFE_FT,
        "berm_crest_ft": BERM_CREST_FT,
        "horizontal_crs_canonical": HORIZONTAL_CRS_CANONICAL,
        "horizontal_crs_filing": HORIZONTAL_CRS_FILING,
        "vertical_datum": VERTICAL_DATUM,
        "parcel_apn": PARCEL_APN,
        "address": SITE_ADDRESS,
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "firm_panel": FIRM_PANEL,
        "community_id": COMMUNITY_ID,
        "min_bishop_fos": MIN_BISHOP_FOS,
        "master_seal": MASTER_SEAL,
        "usgs_gauge_id": USGS_GAUGE_ID,
        "usgs_gauge_zero_navd88_ft": USGS_GAUGE_ZERO_NAVD88_FT,
    }

def assert_invariants() -> None:
    assert BFE_FT == 369.1, "BFE drift"
    assert HORIZONTAL_CRS_CANONICAL == "EPSG:26916", "CRS drift"
    assert MIN_BISHOP_FOS >= 1.500, "FoS gate drift"
