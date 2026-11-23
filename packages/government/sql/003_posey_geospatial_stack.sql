-- TSM Posey geospatial source stack: additive to existing government evidence fabric.
-- Source registration never implies acquisition, validation, or legal reuse.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS geotwin;

CREATE TABLE IF NOT EXISTS geotwin.source (
    source_id text PRIMARY KEY,
    category text NOT NULL CHECK(category IN ('terrain','building','parcel','road','imagery','history','waterway','floodplain','levee')),
    agency text NOT NULL,
    title text NOT NULL,
    endpoint text NOT NULL CHECK(endpoint LIKE 'https://%'),
    ingest_mode text NOT NULL CHECK(ingest_mode IN ('ARCGIS_GEOJSON','LOCAL_GEOJSON','RASTER_ASSET','REFERENCE_ONLY')),
    authority_note text NOT NULL,
    reuse_status text NOT NULL DEFAULT 'REVIEW_REQUIRED',
    registered_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS geotwin.snapshot (
    snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id text NOT NULL REFERENCES geotwin.source(source_id),
    source_url text NOT NULL CHECK(source_url LIKE 'https://%'),
    sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
    byte_length bigint NOT NULL CHECK(byte_length > 0),
    retrieved_at timestamptz NOT NULL,
    acquisition_date date,
    effective_date date,
    source_crs text NOT NULL,
    vertical_datum text,
    license_note text NOT NULL,
    attribution text NOT NULL,
    raw_object_uri text NOT NULL,
    evidence_class text NOT NULL CHECK(evidence_class IN ('SOURCE_OBSERVATION','SOURCE_REFERENCE','DERIVED','HISTORICAL')),
    review_status text NOT NULL DEFAULT 'STAGED'
        CHECK(review_status IN ('STAGED','APPROVED_FOR_VIEW','REJECTED')),
    feature_count integer NOT NULL DEFAULT 0 CHECK(feature_count >= 0),
    provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(source_id,sha256)
);
CREATE INDEX IF NOT EXISTS snapshot_latest_idx ON geotwin.snapshot(source_id,retrieved_at DESC);
CREATE TABLE IF NOT EXISTS geotwin.feature (
    snapshot_id uuid NOT NULL REFERENCES geotwin.snapshot(snapshot_id) ON DELETE RESTRICT,
    feature_id text NOT NULL,
    geom geometry(Geometry,4326) NOT NULL,
    properties jsonb NOT NULL,
    feature_sha256 text NOT NULL CHECK(feature_sha256 ~ '^[a-f0-9]{64}$'),
    PRIMARY KEY (snapshot_id,feature_id),
    CHECK(ST_IsValid(geom)), CHECK(NOT ST_IsEmpty(geom))
);
CREATE INDEX IF NOT EXISTS geotwin_feature_gist ON geotwin.feature USING gist(geom);
CREATE TABLE IF NOT EXISTS geotwin.asset (
    asset_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id uuid NOT NULL REFERENCES geotwin.snapshot(snapshot_id) ON DELETE RESTRICT,
    asset_kind text NOT NULL CHECK(asset_kind IN ('DEM','COPC','ORTHOPHOTO','SCAN','PHOTO','OTHER')),
    local_path text NOT NULL,
    sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
    byte_length bigint NOT NULL CHECK(byte_length > 0),
    horizontal_crs text NOT NULL,
    vertical_datum text,
    acquisition_date date,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS geotwin.review_event (
    review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id uuid NOT NULL REFERENCES geotwin.snapshot(snapshot_id),
    reviewer_id text NOT NULL CHECK(length(trim(reviewer_id)) > 0),
    decision text NOT NULL CHECK(decision IN ('APPROVED_FOR_VIEW','REJECTED')),
    scope text NOT NULL,
    rationale text NOT NULL CHECK(length(trim(rationale)) > 0),
    reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION geotwin.reject_review_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'GEOTWIN_REVIEW_EVENTS_APPEND_ONLY'; END; $$;
DROP TRIGGER IF EXISTS geotwin_review_immutable ON geotwin.review_event;
CREATE TRIGGER geotwin_review_immutable BEFORE UPDATE OR DELETE ON geotwin.review_event
FOR EACH ROW EXECUTE FUNCTION geotwin.reject_review_mutation();

-- Exact source URLs are discoverable; their contents are NOT pre-approved.
INSERT INTO geotwin.source(source_id,category,agency,title,endpoint,ingest_mode,authority_note) VALUES
('igio-parcels','parcel','Indiana GIO','Current Indiana parcel boundaries',
 'https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_Current/FeatureServer/0','ARCGIS_GEOJSON','Parcel polygons, not surveyed property lines'),
('igio-roads','road','Indiana GIO','Current Indiana road centerlines',
 'https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_Current/FeatureServer/0','ARCGIS_GEOJSON','County-submitted centerlines, not construction plans'),
('igio-buildings','building','Indiana GIO','Indiana building footprints 2016-2020',
 'https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0','ARCGIS_GEOJSON','Footprints; no independently verified height implied'),
('igio-imagery','imagery','Indiana GIO','Indiana current orthophotography',
 'https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_Current_Imagery/ImageServer','RASTER_ASSET','Per-tile flight date and reuse rights require review'),
('usgs-3dep','terrain','USGS','3DEP DEM and lidar access',
 'https://apps.nationalmap.gov/lidar-explorer/','RASTER_ASSET','Retain source LAS/DEM CRS, units, and vertical datum'),
('fema-nfhl','floodplain','FEMA','National Flood Hazard Layer',
 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer','LOCAL_GEOJSON','Effective FEMA flood hazard, panel and effective date must be matched'),
('indnr-bafl','floodplain','Indiana DNR','Best Available Floodplain Mapping',
 'https://gisdata.in.gov/server/rest/services/Hosted/FloodHazard_BestAvai_DNR_Watergdb/FeatureServer/0','LOCAL_GEOJSON','DNR planning data; NOT FEMA flood-insurance determination'),
('usace-nld','levee','USACE','National Levee Database',
 'https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer/7','LOCAL_GEOJSON','Levee records; not an engineering certification'),
('usgs-hydro','waterway','USGS','USGS 3D Hydrography',
 'https://api.water.usgs.gov/','LOCAL_GEOJSON','Preserve program release and hydrologic identifiers'),
('osm-roads','road','OpenStreetMap contributors','OpenStreetMap road context',
 'https://www.openstreetmap.org/copyright','LOCAL_GEOJSON','ODbL attribution and share-alike review; not survey control'),
('sanborn','history','Library of Congress','Historic Sanborn maps',
 'https://www.loc.gov/collections/sanborn-maps/','REFERENCE_ONLY','Check item, date, correct Posey County and rights before georeferencing'),
('historic-topo','history','USGS','Historical USGS topographic quadrangles',
 'https://ngmdb.usgs.gov/topoview/','REFERENCE_ONLY','Historic reference only, not current infrastructure or elevation')
ON CONFLICT(source_id) DO NOTHING;
