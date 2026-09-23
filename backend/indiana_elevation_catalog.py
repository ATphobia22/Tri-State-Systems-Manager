"""Indiana Statewide Elevation Catalog provenance adapter.

The catalog is an Indiana Geographic Information Office / IOT Office of
Technology state elevation archive. Catalog metadata is provenance only: it
does not infer tile paths, vertical datums, survey control, or certification.
"""

from __future__ import annotations

from backend.open_data_registry import indiana_elevation_registry_entry

INDIANA_ELEVATION_CATALOG_URL = "https://elevation.gio.in.gov/"
INDIANA_ELEVATION_S3_BROWSER_URL = "https://giselevationingov.s3.amazonaws.com/index.html"
INDIANA_ELEVATION_BUCKET_ARN = "arn:aws:s3:::giselevationingov"
INDIANA_ELEVATION_REGION = "us-east-2"
INDIANA_POSEY_2020_COVERAGE_URL = "https://gis.iu.edu/s/isdp/page/20162020elevation"
INDIANA_POSEY_2020_EXAMPLE_ITEM_URL = "https://gis.iu.edu/s/isdp/item/86452"
INDIANA_LIDAR_VIEWER_URL = (
    "https://indianamap-inmap.hub.arcgis.com/maps/"
    "ff98e3834d464619bd5c8974b0038a13/about"
)


def source_manifest() -> dict[str, str]:
    registry = indiana_elevation_registry_entry()
    return {
        "source_id": "INDIANA_STATEWIDE_ELEVATION_CATALOG",
        "source_name": "Indiana Statewide Elevation Catalog",
        "authority_class": "STATE_MANAGED_ELEVATION_ARCHIVE",
        "managed_by": "Indiana Geographic Information Office / IOT Office of Technology",
        "jurisdiction": "Indiana",
        "catalog_url": INDIANA_ELEVATION_CATALOG_URL,
        "registry_repository": registry.repository,
        "registry_commit": registry.commit,
        "registry_path": registry.path,
        "registry_blob_sha": registry.blob_sha,
        "registry_raw_url": registry.raw_url,
        "s3_browser_url": INDIANA_ELEVATION_S3_BROWSER_URL,
        "bucket_arn": INDIANA_ELEVATION_BUCKET_ARN,
        "region": INDIANA_ELEVATION_REGION,
        "viewer_url": INDIANA_LIDAR_VIEWER_URL,
        "posey_collection_year": "2020",
        "posey_collection_format": "LAS",
        "posey_collection_units": "feet",
        "posey_coverage_index_url": INDIANA_POSEY_2020_COVERAGE_URL,
        "posey_example_quad_url": INDIANA_POSEY_2020_EXAMPLE_ITEM_URL,
        "license": "CC0",
        "data_classes": "LAS LiDAR; elevation archive",
        "professional_certification_authority": "NONE",
        "survey_control_authority": "NONE",
        "regulatory_determination_authority": "NONE",
    }
