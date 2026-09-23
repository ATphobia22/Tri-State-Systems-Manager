"""CountyGISMaps.com Posey County secondary GIS source metadata.

This source is a secondary, non-government GIS visualization/data service.
It is never promoted to deed, survey, FEMA, assessor, or professional
elevation authority.
"""

from __future__ import annotations

from typing import Final

POSEY_COUNTY_GISMAPS_URL: Final[str] = "https://countygismaps.com/map/in/posey"
POSEY_COUNTY_GISMAPS_OVERVIEW_URL: Final[str] = "https://countygismaps.com/in/posey"


def source_manifest() -> dict[str, str]:
    """Return an explicit fail-closed provenance manifest."""
    return {
        "source_id": "POSEY_COUNTYGISMAPS",
        "authority_class": "SECONDARY_DATA_SERVICE",
        "jurisdiction": "Posey County, Indiana",
        "map_url": POSEY_COUNTY_GISMAPS_URL,
        "overview_url": POSEY_COUNTY_GISMAPS_OVERVIEW_URL,
        "parcel_geometry_authority": "UNVERIFIED",
        "property_record_authority": "NONE",
        "elevation_certification_authority": "NONE",
    }
