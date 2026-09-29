-- TSM staging/verification schema for normalized hydraulic cells.
-- Runtime remains native/offline; this schema is for controlled data staging and verification.
-- Retargeted to EPSG:2966 (NAD83 / Indiana West, ftUS) per TSM repo convention;
-- upstream hydraulic outputs in other CRSs must be transformed before staging.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS staging;

CREATE TABLE IF NOT EXISTS staging.ras_cells (
    cell_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    geom geometry(Point, 2966) NOT NULL,
    depth_m DOUBLE PRECISION NOT NULL CHECK (depth_m >= 0),
    wse_m DOUBLE PRECISION,
    velocity_ms DOUBLE PRECISION CHECK (velocity_ms IS NULL OR velocity_ms >= 0),
    source_sha256 CHAR(64) NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
    source_uri TEXT NOT NULL,
    source_retrieved_at TIMESTAMPTZ NOT NULL,
    target_crs TEXT NOT NULL DEFAULT 'EPSG:2966',
    review_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW'
        CHECK (review_status IN ('PENDING_REVIEW','VERIFIED','REJECTED')),
    PRIMARY KEY (plan_id, cell_id),
    CONSTRAINT ras_cells_target_crs CHECK (target_crs = 'EPSG:2966')
);

CREATE INDEX IF NOT EXISTS ras_cells_geom_gist
    ON staging.ras_cells USING GIST (geom);
CREATE INDEX IF NOT EXISTS ras_cells_plan_idx
    ON staging.ras_cells (plan_id);
CREATE INDEX IF NOT EXISTS ras_cells_depth_idx
    ON staging.ras_cells (depth_m) WHERE depth_m > 0;

COMMENT ON TABLE staging.ras_cells IS
    'Normalized HEC-RAS hydraulic state for controlled staging, EPSG:2966. Not a regulatory determination and not an authoritative source by itself.';
