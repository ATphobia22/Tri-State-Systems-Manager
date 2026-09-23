"""Equator Studios Posey County secondary GIS source metadata.

Equator advertises parcel/building, LiDAR, contours, DEM, point-cloud and
multiple export formats for Posey County. No undocumented API endpoint or
download URL is inferred here; the adapter records the public source and its
data classes for provenance only.
"""

POSEY_EQUATOR_URL = "https://gis.equatorstudios.com/indiana_posey/"
POSEY_EQUATOR_MAP_URL = "https://maps.equatorstudios.com/"

def source_manifest() -> dict[str, str]:
    return {
        "source_id": "POSEY_EQUATOR_STUDIOS",
        "source_name": "Equator Studios Posey County GIS",
        "authority_class": "SECONDARY_COMMERCIAL_GIS",
        "jurisdiction": "Posey County, Indiana",
        "source_url": POSEY_EQUATOR_URL,
        "map_url": POSEY_EQUATOR_MAP_URL,
        "parcel_geometry_authority": "UNVERIFIED",
        "elevation_certification_authority": "NONE",
        "advertised_data_classes": "parcels, buildings, LiDAR, contours, DEM, point clouds",
    }
