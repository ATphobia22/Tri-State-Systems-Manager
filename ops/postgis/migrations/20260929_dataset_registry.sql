-- TSM dataset registry: provenance record for every dataset staged into the
-- offline pipeline (PDAL -> TSMImport -> PostGIS -> TSMSimulation ->
-- TSMEvidence -> TSMTerrain -> TSMGIS). Reference only; registry entries are
-- not survey evidence and not regulatory determinations.
-- SHA-256 values are produced by TSMCrypto (genuine FIPS 180-4, not MD5/SHA-1).
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS dataset_registry (
    dataset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_name TEXT NOT NULL,
    source_uri TEXT,
    sha256_hash CHAR(64) CHECK (sha256_hash IS NULL OR sha256_hash ~ '^[0-9a-f]{64}$'),
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    validated BOOLEAN NOT NULL DEFAULT FALSE,
    -- Provenance classification mirrors the parcel pipeline convention.
    provenance_status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (provenance_status IN ('PENDING','VERIFIED','QUARANTINED','STALE')),
    target_crs TEXT NOT NULL DEFAULT 'EPSG:2966'
        CHECK (target_crs = 'EPSG:2966'),
    CONSTRAINT dataset_registry_name_not_empty CHECK (dataset_name <> '')
);

CREATE INDEX IF NOT EXISTS dataset_registry_validated_idx
    ON dataset_registry (validated);
CREATE INDEX IF NOT EXISTS dataset_registry_status_idx
    ON dataset_registry (provenance_status);
CREATE INDEX IF NOT EXISTS dataset_registry_acquired_idx
    ON dataset_registry (acquired_at DESC);
