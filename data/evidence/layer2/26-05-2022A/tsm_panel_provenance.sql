-- TSM Layer 2 — Panel provenance / LAG-BFE validation log
-- Fail-closed: does not assert LOMA approval or premium overcharge.

CREATE TABLE IF NOT EXISTS public.tsm_panel_provenance (
    id SERIAL PRIMARY KEY,
    panel_number VARCHAR(16) NOT NULL,
    community_number VARCHAR(12),
    case_number VARCHAR(32),
    source_dataset VARCHAR(128) NOT NULL,
    computed_lag_navd88_ft NUMERIC(8, 2),
    effective_bfe_navd88_ft NUMERIC(8, 2),
    freeboard_ft NUMERIC(8, 2) GENERATED ALWAYS AS (
        CASE
            WHEN computed_lag_navd88_ft IS NOT NULL
             AND effective_bfe_navd88_ft IS NOT NULL
            THEN computed_lag_navd88_ft - effective_bfe_navd88_ft
            ELSE NULL
        END
    ) STORED,
    horizontal_crs VARCHAR(32) NOT NULL DEFAULT 'EPSG:2966',
    vertical_datum VARCHAR(32) NOT NULL DEFAULT 'NAVD88',
    latitude_wgs84 NUMERIC(12, 8),
    longitude_wgs84 NUMERIC(12, 8),
    sha256_hash CHAR(64) NOT NULL,
    human_authorized BOOLEAN NOT NULL DEFAULT FALSE,
    reviewer_identity TEXT,
    review_reason TEXT,
    reviewed_at TIMESTAMPTZ,
    verification_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    CONSTRAINT tsm_panel_provenance_hash_hex CHECK (sha256_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT tsm_panel_provenance_human_gate CHECK (
        human_authorized = FALSE
        OR (
            reviewer_identity IS NOT NULL
            AND review_reason IS NOT NULL
            AND reviewed_at IS NOT NULL
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_tsm_panel_provenance_panel
    ON public.tsm_panel_provenance (panel_number);

CREATE INDEX IF NOT EXISTS idx_tsm_panel_provenance_case
    ON public.tsm_panel_provenance (case_number);

COMMENT ON TABLE public.tsm_panel_provenance IS
  'TSM Evidence plane: panel/LAG/BFE provenance. Simulation rows must not be labeled production determinations.';
