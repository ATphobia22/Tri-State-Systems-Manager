# TSM Government / Invariant Plane
# Community scope: lower Wabash-Ohio confluence / Tri-State River Valley.
# No private residence, parcel identifier, or house-specific target is stored here.
from typing import Final

BFE_FT: Final[float] = 375.0
LAG_FT: Final[float] = 377.2
HORIZONTAL_CRS: Final[str] = 'EPSG:2966'
VERTICAL_DATUM: Final[str] = 'NAVD88'
PARCEL_APN: Final[str] = 'COMMUNITY_SCOPE'
MASTER_SEAL: Final[str] = '07e7dc7b6e16d8aed4422188b18f297db12193b9351837c3b9b0d15a5ab4249d'
FFE_FT: Final[float] = 382.5
BERM_CREST_FT: Final[float] = 379.8
FIRM_PANEL: Final[str] = 'SOURCE_REQUIRED'
COMMUNITY_ID: Final[str] = '180209'


def assert_invariants() -> None:
    """Validate non-private geodetic and cryptographic invariants."""
    assert HORIZONTAL_CRS == 'EPSG:2966'
    assert VERTICAL_DATUM == 'NAVD88'
    assert BFE_FT < LAG_FT < FFE_FT
    assert BERM_CREST_FT > BFE_FT
    assert len(MASTER_SEAL) == 64 and all(c in '0123456789abcdef' for c in MASTER_SEAL)
    assert FIRM_PANEL == 'SOURCE_REQUIRED'
    assert PARCEL_APN == 'COMMUNITY_SCOPE'


if __name__ == '__main__':
    assert_invariants()
    print('[site_constants] community-scope invariants OK — project evidence required')
