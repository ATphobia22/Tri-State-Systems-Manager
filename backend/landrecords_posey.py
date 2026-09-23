"""LandRecords.us Posey County secondary parcel-data source metadata.

The public coverage page documents a county parcel dataset and attribute
coverage. It is not treated as a county assessor, recorder, survey, FEMA, or
professional elevation-certification authority.
"""

POSEY_LANDRECORDS_URL = "https://landrecords.us/documentation/coverage/counties/18-129-posey"
LANDRECORDS_API_DOCS_URL = "https://landrecords.us/documentation/web-api"

def source_manifest() -> dict[str, str]:
    return {
        "source_id": "POSEY_LANDRECORDS",
        "source_name": "Land Records — Posey County parcel dataset",
        "authority_class": "SECONDARY_NATIONAL_PARCEL_DATASET",
        "jurisdiction": "Posey County, Indiana",
        "source_url": POSEY_LANDRECORDS_URL,
        "api_docs_url": LANDRECORDS_API_DOCS_URL,
        "parcel_geometry_authority": "UNVERIFIED",
        "property_record_authority": "NONE",
        "elevation_certification_authority": "NONE",
    }
