-- TSM HEC-RAS 2D cell-center spatial registry.
-- Horizontal geometry only. Vertical datum/model outputs remain separate evidence planes.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS engineering;

CREATE TABLE IF NOT EXISTS engineering.hec_ras_cell_centers (
    flow_area_name TEXT NOT NULL,
    cell_id INTEGER NOT NULL,
    geom geometry(Point, 2966) NOT NULL,
    source_x DOUBLE PRECISION NOT NULL,
    source_y DOUBLE PRECISION NOT NULL,
    source_crs TEXT NOT NULL,
    target_crs TEXT NOT NULL DEFAULT 'EPSG:2966',
    source_artifact_sha256 CHAR(64) NOT NULL,
    source_record_id TEXT NOT NULL,
    review_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (flow_area_name, cell_id),
    CONSTRAINT hec_ras_cell_target_crs CHECK (target_crs = 'EPSG:2966'),
    CONSTRAINT hec_ras_cell_source_crs_nonempty CHECK (length(trim(source_crs)) > 0),
    CONSTRAINT hec_ras_cell_hash_valid CHECK (source_artifact_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT hec_ras_cell_record_nonempty CHECK (length(trim(source_record_id)) > 0),
    CONSTRAINT hec_ras_cell_review_status CHECK (
        review_status IN ('PENDING_REVIEW', 'VERIFIED', 'REJECTED')
    ),
    CONSTRAINT hec_ras_cell_geom_valid CHECK (
        NOT ST_IsEmpty(geom) AND ST_IsValid(geom)
    )
);

CREATE INDEX IF NOT EXISTS hec_ras_cell_centers_geom_gist
    ON engineering.hec_ras_cell_centers USING GIST (geom);

COMMENT ON TABLE engineering.hec_ras_cell_centers IS
'Privacy-reduced HEC-RAS computational cell centers transformed into EPSG:2966. No owner, APN, or address data is stored.';
