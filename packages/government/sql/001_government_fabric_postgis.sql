-- TSM Government Data Fabric: optional PostGIS migration.
-- Apply only to a separately provisioned PostGIS 3.x database.
CREATE SCHEMA IF NOT EXISTS government;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS government.source (
 source_id text PRIMARY KEY,
 authority text NOT NULL CHECK(authority IN ('FEMA','USGS','NOAA','CENSUS','EPA','USDA','DOT','USACE','NASA')),
 endpoint text NOT NULL CHECK(endpoint LIKE 'https://%'),
 catalog_version text NOT NULL,
 registered_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS government.dataset (
 dataset_id text PRIMARY KEY,
 source_id text NOT NULL REFERENCES government.source(source_id),
 dataset_version text NOT NULL,
 retrieved_at timestamptz NOT NULL,
 acquisition_date date,
 effective_date date,
 source_crs text,
 vertical_datum text,
 units text,
 classification text NOT NULL CHECK(classification IN ('OBSERVED','DERIVED','SCENARIO_SIMULATION_DEMO','REGULATORY')),
 validation_status text NOT NULL CHECK(validation_status IN ('PASS','FAIL','UNVERIFIED')),
 authorization_status text NOT NULL DEFAULT 'NOT_EVIDENCED' CHECK(authorization_status IN ('VERIFIED','PENDING','BLOCKED','NOT_EVIDENCED')),
 sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
 byte_length bigint NOT NULL CHECK(byte_length>0),
 media_type text NOT NULL,
 attribution text NOT NULL,
 license text NOT NULL,
 manifest jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS government_dataset_source_time_idx ON government.dataset(source_id,retrieved_at DESC);
CREATE TABLE IF NOT EXISTS government.feature (
 dataset_id text NOT NULL REFERENCES government.dataset(dataset_id),
 feature_id text NOT NULL,
 geom geometry(Geometry,4326) NOT NULL,
 properties jsonb NOT NULL,
 source_feature_hash char(64) NOT NULL CHECK(source_feature_hash ~ '^[0-9a-f]{64}$'),
 PRIMARY KEY(dataset_id,feature_id),
 CHECK(ST_IsValid(geom)),
 CHECK(NOT ST_IsEmpty(geom))
);
CREATE INDEX IF NOT EXISTS government_feature_spatial_idx ON government.feature USING gist(geom);
-- A separately authenticated ingestion service must verify the complete raw bytes against
-- manifest.sha256 and transform CRS/datum explicitly BEFORE creating these rows.
-- No automatic elevation transformation or regulatory certification occurs in SQL.
