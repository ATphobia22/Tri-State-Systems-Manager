CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS imported_assets (
    asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_type TEXT NOT NULL,
    asset_name TEXT NOT NULL,
    source_path TEXT NOT NULL,
    sha256 TEXT NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
    file_size_bytes BIGINT,
    horizontal_datum TEXT,
    vertical_datum TEXT,
    epsg INTEGER,
    status TEXT NOT NULL DEFAULT 'RECEIVED',
    authority_class TEXT NOT NULL DEFAULT 'DERIVED',
    engineering_use BOOLEAN NOT NULL DEFAULT FALSE,
    regulatory_use BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES imported_assets (asset_id),
    status TEXT NOT NULL,
    stage TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    worker_name TEXT,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS evidence_bundles (
    bundle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES imported_assets (asset_id),
    input_hash TEXT,
    metadata_hash TEXT NOT NULL,
    provenance_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
