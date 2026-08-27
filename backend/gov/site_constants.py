# PTDT v35 Sovereign Core - Site Constants & Invariant Assertion
# Anchor: 13101 Bonebank Road, Point Township, Posey County, Indiana
# Master Seal: b4782912564e70e863a7938bb3700647580830fb5a81e910a0db49a20f73b32e
from typing import Final

BFE_FT: Final[float] = 375.0
LAG_FT: Final[float] = 377.2
HORIZONTAL_CRS: Final[str] = "EPSG:2966"          # Indiana West ftUS only
VERTICAL_DATUM: Final[str] = "NAVD88"
PARCEL_APN: Final[str] = "65-19-08-100-008.001-010"
MASTER_SEAL: Final[str] = "b4782912564e70e863a7938bb3700647580830fb5a81e910a0db49a20f73b32e"
FFE_FT: Final[float] = 382.5
BERM_CREST_FT: Final[float] = 379.8
FIRM_PANEL: Final[str] = "18129C0215D"
COMMUNITY_ID: Final[str] = "180209"

def assert_invariants() -> None:
    """Fail-closed geodetic and cryptographic invariant check."""
    assert BFE_FT == 375.0 and LAG_FT == 377.2, "BFE/LAG mismatch"
    assert abs(LAG_FT - BFE_FT - 2.2) < 1e-6, "Freeboard clearance must be +2.2 ft"
    assert HORIZONTAL_CRS == "EPSG:2966", "HORIZONTAL_CRS must be EPSG:2966 (reject 2967)"
    assert VERTICAL_DATUM == "NAVD88", "Vertical datum must be NAVD88"
    assert len(MASTER_SEAL) == 64 and all(c in "0123456789abcdef" for c in MASTER_SEAL), "Invalid MASTER_SEAL"
    assert PARCEL_APN == "65-19-08-100-008.001-010", "APN mismatch"

if __name__ == "__main__":
    assert_invariants()
    print("[site_constants] invariants OK — EPSG:2966 / BFE 375.0 / LAG 377.2")
