-- Migration 120: core ingestion registry (fail-closed, hash-bound)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS imported_assets (
    asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_type TEXT NOT NULL,
    asset_name TEXT NOT NULL,
    source_id TEXT,
    source_path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    file_size_bytes BIGINT,
    horizontal_datum TEXT,
    vertical_datum TEXT,
    epsg INTEGER,
    status TEXT NOT NULL
        CHECK (status IN (
            'RECEIVED', 'QUARANTINED', 'VALIDATED',
            'REJECTED', 'PROMOTED', 'ARCHIVED'
        )),
    authority_class TEXT NOT NULL DEFAULT 'DERIVED'
        CHECK (authority_class IN (
            'AUTHORITATIVE', 'DERIVED', 'CONTEXT', 'SIMULATION_DEMO'
        )),
    engineering_use BOOLEAN NOT NULL DEFAULT FALSE,
    regulatory_use BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT imported_assets_sha256_hex
        CHECK (sha256 ~ '^[a-f0-9]{64}$')
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES imported_assets (asset_id),
    status TEXT NOT NULL
        CHECK (status IN (
            'PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD_LETTER'
        )),
    stage TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    worker_name TEXT,
    error_message TEXT,
    idempotency_key TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ingestion_runs_idempotency
    ON ingestion_runs (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS evidence_bundles (
    bundle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES imported_assets (asset_id),
    input_hash TEXT NOT NULL,
    metadata_hash TEXT NOT NULL,
    provenance_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spatial_layers (
    layer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layer_name TEXT NOT NULL UNIQUE,
    source_table TEXT NOT NULL,
    geometry_type TEXT,
    epsg INTEGER,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    authority_class TEXT NOT NULL DEFAULT 'CONTEXT'
);

CREATE TABLE IF NOT EXISTS replay_verifications (
    verification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_run_id UUID REFERENCES ingestion_runs (run_id),
    replay_run_id UUID REFERENCES ingestion_runs (run_id),
    equivalent BOOLEAN,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
