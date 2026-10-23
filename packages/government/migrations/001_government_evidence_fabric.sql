-- PostgreSQL/PostGIS migration. Apply through the platform's reviewed migration runner.
BEGIN;
CREATE TABLE IF NOT EXISTS government_sources (
 source_id TEXT PRIMARY KEY,
 source_name TEXT NOT NULL,
 agency TEXT NOT NULL,
 authority_level TEXT NOT NULL CHECK (authority_level IN ('AUTHORITATIVE','REFERENCE','SUPPLEMENTAL')),
 endpoint TEXT NOT NULL CHECK (endpoint LIKE 'https://%'),
 update_frequency TEXT,
 citation_required BOOLEAN NOT NULL DEFAULT TRUE,
 geometry_enabled BOOLEAN NOT NULL DEFAULT FALSE,
 provenance_required BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ingestion_runs (
 run_id UUID PRIMARY KEY,
 source_id TEXT NOT NULL REFERENCES government_sources(source_id),
 dataset_version TEXT,
 checksum_sha256 TEXT CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}$'),
 record_count BIGINT CHECK (record_count IS NULL OR record_count >= 0),
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 completed_at TIMESTAMPTZ,
 status TEXT NOT NULL CHECK (status IN ('PENDING','FETCHING','VALIDATING','HASHED','INGESTED','PUBLISHED','FAILED','REJECTED')),
 error_message TEXT,
 CHECK (completed_at IS NULL OR completed_at >= started_at)
);
CREATE TABLE IF NOT EXISTS provenance_records (
 provenance_id UUID PRIMARY KEY,
 source_id TEXT NOT NULL REFERENCES government_sources(source_id),
 dataset_hash TEXT NOT NULL CHECK (dataset_hash ~ '^[a-f0-9]{64}$'),
 parent_hash TEXT CHECK (parent_hash IS NULL OR parent_hash ~ '^[a-f0-9]{64}$'),
 retrieval_timestamp TIMESTAMPTZ NOT NULL,
 validator_version TEXT NOT NULL,
 evidence_id UUID,
 evidence_hash TEXT NOT NULL CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
 attestation_hash TEXT CHECK (attestation_hash IS NULL OR attestation_hash ~ '^[a-f0-9]{64}$')
);
CREATE TABLE IF NOT EXISTS government_datasets (
 dataset_id UUID PRIMARY KEY,
 source_id TEXT NOT NULL REFERENCES government_sources(source_id),
 dataset_name TEXT NOT NULL,
 dataset_version TEXT NOT NULL,
 retrieved_at TIMESTAMPTZ NOT NULL,
 checksum_sha256 TEXT NOT NULL CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
 feature_count BIGINT CHECK (feature_count IS NULL OR feature_count >= 0),
 geometry_type TEXT CHECK (geometry_type IS NULL OR geometry_type IN ('Point','MultiPoint','Polygon','MultiPolygon','Polyline','MultiLineString')),
 horizontal_crs TEXT,
 vertical_datum TEXT,
 acquisition_date DATE,
 attribution TEXT NOT NULL,
 license TEXT NOT NULL,
 validation_status TEXT NOT NULL CHECK (validation_status IN ('PASS','FAIL','UNVERIFIED')),
 raw_object_uri TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS government_datasets_source_version_idx ON government_datasets(source_id,dataset_version);
CREATE INDEX IF NOT EXISTS provenance_records_dataset_hash_idx ON provenance_records(dataset_hash);
-- Geometry-bearing features are stored in source-specific tables with explicit SRID/geometry constraints.
-- Do not use a generic geometry column until geometry type and CRS are validated per dataset.
COMMIT;
