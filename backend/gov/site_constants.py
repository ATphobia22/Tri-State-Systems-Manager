# TSM Government / Invariant Plane
# Community scope: lower Wabash-Ohio confluence / Tri-State River Valley.
# No private residence, parcel identifier, or house-specific target is stored here.
from typing import Final

BFE_FT: Final[float] = 375.0
LAG_FT: Final[float] = 377.2
HORIZONTAL_CRS: Final[str] = 'EPSG:2966'
VERTICAL_DATUM: Final[str] = 'NAVD88'
MASTER_SEAL: Final[str] = 'community-scope-evidence-required'
FFE_FT: Final[float] = 382.5
BERM_CREST_FT: Final[float] = 379.8
FIRM_PANEL: Final[str] = 'SOURCE_REQUIRED'
COMMUNITY_ID: Final[str] = '180209'


def assert_invariants() -> None:
    """Validate non-private geodetic invariants; project values remain evidence-gated."""
    assert HORIZONTAL_CRS == 'EPSG:2966'
    assert VERTICAL_DATUM == 'NAVD88'
    assert BFE_FT < LAG_FT < FFE_FT
    assert BERM_CREST_FT > BFE_FT
    assert FIRM_PANEL == 'SOURCE_REQUIRED'


if __name__ == '__main__':
    assert_invariants()
    print('[site_constants] community-scope invariants OK — project evidence required')
