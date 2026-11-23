-- TSM Posey Regional Twin: opt-in additive schema, separate from the existing government ledger.
-- This migration contains NO sampled or fabricated observations and never promotes a source on registration.
BEGIN;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS twin_geo;

CREATE TABLE IF NOT EXISTS twin_geo.source (
 source_id text PRIMARY KEY CHECK (source_id ~ '^[a-z0-9-]{3,80}$'),
 authority text NOT NULL,
 domain text NOT NULL CHECK (domain IN ('TERRAIN','BUILDINGS','PARCELS','STREETS','IMAGERY','HISTORY','HYDROLOGY','FLOODPLAIN','SIMULATION')),
 endpoint text NOT NULL CHECK (endpoint LIKE 'https://%'),
 source_role text NOT NULL CHECK (source_role IN ('GOVERNMENT','REFERENCE','HISTORICAL','MODEL')),
 transport text NOT NULL CHECK (transport IN ('ARCGIS_FEATURE','ARCGIS_MAP','TNM_PRODUCTS','WATERDATA_OGC','FILE_CATALOG','ARCHIVE_CATALOG','EXTERNAL_REFERENCE')),
 evidence_class text NOT NULL CHECK (evidence_class IN ('OBSERVED','REGULATORY','PLANNING','HISTORICAL','REFERENCE','SIMULATION')),
 source_note text NOT NULL DEFAULT '',
 registered_at timestamptz NOT NULL DEFAULT now()
);

-- A registered upstream is NOT a downloaded or verified dataset.
INSERT INTO twin_geo.source(source_id,authority,domain,endpoint,source_role,transport,evidence_class,source_note) VALUES
 ('igio-buildings','Indiana Geographic Information Office','BUILDINGS','https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0','GOVERNMENT','ARCGIS_FEATURE','OBSERVED','Indiana footprint collection 2016-2020; geometry is not independently surveyed building height'),
 ('igio-parcels','Indiana Geographic Information Office','PARCELS','https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_Current/FeatureServer/0','GOVERNMENT','ARCGIS_FEATURE','REFERENCE','County-supplied parcels; parcel geometry is not a boundary survey'),
 ('igio-roads','Indiana Geographic Information Office','STREETS','https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_Current/FeatureServer/0','GOVERNMENT','ARCGIS_FEATURE','REFERENCE','County-maintained road centerlines; verify update dates'),
 ('igio-county','Indiana Geographic Information Office','PARCELS','https://gisdata.in.gov/server/rest/services/Hosted/County_Boundaries_of_Indiana_Current/FeatureServer/0','GOVERNMENT','ARCGIS_FEATURE','REFERENCE','Posey AOI selection via official county FIPS 18129'),
 ('indnr-flood','Indiana Department of Natural Resources','FLOODPLAIN','https://gisdata.in.gov/server/rest/services/Hosted/FloodHazard_BestAvai_DNR_Watergdb/FeatureServer/0','GOVERNMENT','ARCGIS_FEATURE','PLANNING','Best available flood hazard planning; not a substitute for effective FEMA NFHL'),
 ('fema-nfhl','FEMA','FLOODPLAIN','https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer','GOVERNMENT','ARCGIS_MAP','REGULATORY','Verify effective DFIRM panel and dates separately'),
 ('usace-nld','US Army Corps of Engineers','HYDROLOGY','https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer','GOVERNMENT','ARCGIS_FEATURE','REFERENCE','Levee source; layer IDs require verified selection'),
 ('usgs-3dep','US Geological Survey','TERRAIN','https://tnmaccess.nationalmap.gov/api/v1/products','GOVERNMENT','TNM_PRODUCTS','OBSERVED','3DEP DEM and LiDAR product discovery; no raster downloaded by this migration'),
 ('usgs-hydro','US Geological Survey','HYDROLOGY','https://api.waterdata.usgs.gov/ogcapi/v1/','GOVERNMENT','WATERDATA_OGC','OBSERVED','Time-stamped observations; stage is not NAVD88 elevation'),
 ('igio-orthos','Indiana Geographic Information Office','IMAGERY','https://registry.opendata.aws/in-imagery/','GOVERNMENT','FILE_CATALOG','OBSERVED','Preserve exact tile capture date and imagery acquisition cycle'),
 ('osm-indiana','OpenStreetMap contributors','STREETS','https://download.geofabrik.de/north-america/us/indiana.html','REFERENCE','FILE_CATALOG','REFERENCE','ODbL attribution/share-alike review required before publication'),
 ('loc-sanborn','Library of Congress','HISTORY','https://www.loc.gov/collections/sanborn-maps/','HISTORICAL','ARCHIVE_CATALOG','HISTORICAL','Sanborn sheet dates, rights and georeferencing uncertainty required'),
 ('usgs-historical-topo','US Geological Survey','HISTORY','https://apps.nationalmap.gov/downloader/','GOVERNMENT','ARCHIVE_CATALOG','HISTORICAL','Historical quadrangle date and map edition must be retained')
ON CONFLICT (source_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS twin_geo.asset (
 asset_id text PRIMARY KEY CHECK (asset_id ~ '^[a-zA-Z0-9_-]{3,128}$'),
 source_id text NOT NULL REFERENCES twin_geo.source(source_id),
 asset_kind text NOT NULL CHECK(asset_kind IN ('VECTOR','DEM','LIDAR','ORTHOPHOTO','HISTORICAL_MAP','ARCHIVAL_PHOTO','HYDROGRAPHY','MODEL_OUTPUT')),
 source_version text NOT NULL,
 source_url text NOT NULL CHECK (source_url LIKE 'https://%'),
 retrieved_at timestamptz NOT NULL,
 capture_start date,
 capture_end date,
 effective_date date,
 horizontal_crs text NOT NULL,
 vertical_datum text,
 units text,
 raw_sha256 char(64) NOT NULL CHECK(raw_sha256 ~ '^[0-9a-f]{64}$'),
 byte_length bigint NOT NULL CHECK (byte_length > 0),
 storage_uri text NOT NULL,
 license_note text NOT NULL CHECK (length(btrim(license_note)) > 0),
 attribution text NOT NULL CHECK (length(btrim(attribution)) > 0),
 validation_status text NOT NULL DEFAULT 'UNVERIFIED' CHECK(validation_status IN ('UNVERIFIED','PASS','FAIL')),
 publication_status text NOT NULL DEFAULT 'NOT_APPROVED' CHECK(publication_status IN ('NOT_APPROVED','APPROVED_FOR_VIEW')),
 review_id text NOT NULL,
 manifest jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (capture_start IS NULL OR capture_end IS NULL OR capture_start <= capture_end),
 CHECK (asset_kind <> 'ORTHOPHOTO' OR (capture_start IS NOT NULL AND capture_end IS NOT NULL)),
 CHECK (asset_kind NOT IN ('DEM','LIDAR') OR (vertical_datum IS NOT NULL AND units IS NOT NULL)),
 CHECK (publication_status <> 'APPROVED_FOR_VIEW' OR validation_status = 'PASS')
);
CREATE INDEX IF NOT EXISTS twin_geo_asset_source_version_idx ON twin_geo.asset(source_id,retrieved_at DESC);

CREATE TABLE IF NOT EXISTS twin_geo.feature (
 asset_id text NOT NULL REFERENCES twin_geo.asset(asset_id),
 feature_id text NOT NULL,
 geom geometry(Geometry,4326) NOT NULL,
 properties jsonb NOT NULL,
 feature_sha256 char(64) NOT NULL CHECK(feature_sha256 ~ '^[0-9a-f]{64}$'),
 PRIMARY KEY(asset_id,feature_id),
 CHECK (ST_IsValid(geom) AND NOT ST_IsEmpty(geom))
);
CREATE INDEX IF NOT EXISTS twin_geo_feature_geom_gix ON twin_geo.feature USING GIST (geom);

-- Dimensions must cite a *different* observation/evidence source than the footprint.
-- They never become "independently verified" simply by extruding a footprint or DEM.
CREATE TABLE IF NOT EXISTS twin_geo.building_dimension (
 measurement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 footprint_asset_id text NOT NULL,
 footprint_feature_id text NOT NULL,
 evidence_asset_id text NOT NULL REFERENCES twin_geo.asset(asset_id),
 measured_at timestamptz,
 method text NOT NULL CHECK(method IN ('FIELD_SURVEY','INDEPENDENT_LIDAR','APPROVED_PLAN','PHOTOGRAMMETRY')),
 roof_height_m double precision CHECK(roof_height_m IS NULL OR (roof_height_m > 0 AND roof_height_m < 500)),
 ground_navd88_m double precision,
 uncertainty_m double precision NOT NULL CHECK(uncertainty_m >= 0),
 source_feature_id text,
 review_id text NOT NULL CHECK(length(btrim(review_id)) > 0),
 validation_status text NOT NULL CHECK(validation_status IN ('UNVERIFIED','PASS','FAIL')),
 FOREIGN KEY(footprint_asset_id,footprint_feature_id) REFERENCES twin_geo.feature(asset_id,feature_id),
 CHECK(footprint_asset_id <> evidence_asset_id)
);
CREATE INDEX IF NOT EXISTS twin_geo_dim_building_idx ON twin_geo.building_dimension(footprint_asset_id,footprint_feature_id);

CREATE TABLE IF NOT EXISTS twin_geo.model_artifact (
 artifact_id text PRIMARY KEY CHECK(artifact_id ~ '^[a-zA-Z0-9_-]{3,128}$'),
 model_family text NOT NULL CHECK(model_family IN ('HEC_RAS','MODFLOW','OPENFOAM','PHYSICSNEMO','OTHER')),
 model_version text NOT NULL,
 input_asset_ids text[] NOT NULL CHECK(array_length(input_asset_ids,1)>0),
 input_manifest_sha256 char(64) NOT NULL CHECK(input_manifest_sha256 ~ '^[0-9a-f]{64}$'),
 output_sha256 char(64) NOT NULL CHECK(output_sha256 ~ '^[0-9a-f]{64}$'),
 physical_baseline_id text,
 evaluation jsonb NOT NULL DEFAULT '{}'::jsonb,
 validation_status text NOT NULL DEFAULT 'UNVERIFIED' CHECK(validation_status IN ('UNVERIFIED','PASS','FAIL')),
 use_class text NOT NULL DEFAULT 'EXPERIMENTAL' CHECK(use_class IN ('EXPERIMENTAL','REVIEWED_DECISION_SUPPORT')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(use_class <> 'REVIEWED_DECISION_SUPPORT' OR (validation_status = 'PASS' AND physical_baseline_id IS NOT NULL))
);
COMMIT;
