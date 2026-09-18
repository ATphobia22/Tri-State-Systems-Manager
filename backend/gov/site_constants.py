# TSM Government / Geospatial source boundary.
# No site-specific elevation, vertical datum, parcel, or design values are global constants.

from typing import Final

HORIZONTAL_CRS: Final[str] = "EPSG:2966"
VERTICAL_DATUM: Final[str] = "UNVERIFIED"
PARCEL_APN: Final[str] = "SOURCE_REQUIRED"
MASTER_SEAL: Final[str] = "07e7dc7b6e16d8aed4422188b18f297db12193b9351837c3b9b0d15a5ab4249d"
FIRM_PANEL: Final[str] = "SOURCE_REQUIRED"
COMMUNITY_ID: Final[str] = "SOURCE_REQUIRED"


def assert_invariants() -> None:
    """Validate only globally defensible project invariants."""
    assert HORIZONTAL_CRS == "EPSG:2966"
    assert VERTICAL_DATUM == "UNVERIFIED"
    assert PARCEL_APN == "SOURCE_REQUIRED"
    assert FIRM_PANEL == "SOURCE_REQUIRED"
    assert COMMUNITY_ID == "SOURCE_REQUIRED"
    assert len(MASTER_SEAL) == 64 and all(c in "0123456789abcdef" for c in MASTER_SEAL)


if __name__ == "__main__":
    assert_invariants()
    print("[site_constants] source-boundary invariants OK")
