"""Community source boundary; site-specific inputs require project evidence."""
from typing import Final

HORIZONTAL_CRS: Final[str] = "EPSG:2966"
HORIZONTAL_CRS_CANONICAL: Final[str] = "EPSG:26916"
HORIZONTAL_CRS_FILING: Final[str] = HORIZONTAL_CRS
VERTICAL_DATUM: Final[str] = "UNVERIFIED"
PARCEL_APN: Final[str] = "SOURCE_REQUIRED"
MASTER_SEAL: Final[str] = "07e7dc7b6e16d8aed4422188b18f297db12193b9351837c3b9b0d15a5ab4249d"
FIRM_PANEL: Final[str] = "SOURCE_REQUIRED"
COMMUNITY_ID: Final[str] = "SOURCE_REQUIRED"
# Compatibility only; never default project elevation or approval from this module.
BFE_FT: Final[None] = None
MIN_BISHOP_FOS: Final[float] = 1.5  # Screening threshold, not an approval.
USGS_GAUGE_ID: Final[str] = "03378500"
USGS_GAUGE_ZERO_NAVD88_FT: Final[None] = None


def get_sovereign_constants() -> dict:
    return {
        "horizontal_crs_canonical": HORIZONTAL_CRS_CANONICAL,
        "horizontal_crs_filing": HORIZONTAL_CRS_FILING,
        "vertical_datum": VERTICAL_DATUM,
        "project_evidence_required": True,
        "human_review_required": True,
        "regulatory_determination": None,
    }


def assert_invariants() -> None:
    assert HORIZONTAL_CRS == "EPSG:2966"
    assert HORIZONTAL_CRS_CANONICAL == "EPSG:26916"
    assert VERTICAL_DATUM == "UNVERIFIED"
    assert PARCEL_APN == FIRM_PANEL == COMMUNITY_ID == "SOURCE_REQUIRED"
    assert BFE_FT is None and USGS_GAUGE_ZERO_NAVD88_FT is None
    assert len(MASTER_SEAL) == 64 and all(c in "0123456789abcdef" for c in MASTER_SEAL)


if __name__ == "__main__":
    assert_invariants()
    print("[site_constants] source-boundary invariants OK")
