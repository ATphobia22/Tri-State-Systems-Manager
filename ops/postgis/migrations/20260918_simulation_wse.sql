-- TSM scenario-output boundary.
-- Regulatory FEMA evidence is intentionally immutable here: model output never overwrites BFE/zone evidence.

CREATE SCHEMA IF NOT EXISTS hydrology;

CREATE TABLE IF NOT EXISTS hydrology.simulation_wse (
    scenario_id text NOT NULL,
    parcel_id text,
    apn text,
    wse_ft double precision NOT NULL,
    vertical_datum text NOT NULL,
    model_name text NOT NULL,
    model_version text NOT NULL,
    timestep timestamptz,
    source_evidence_sha256 text NOT NULL,
    review_status text NOT NULL DEFAULT 'PENDING_REVIEW',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT simulation_wse_wse_finite CHECK (wse_ft = wse_ft AND abs(wse_ft) < 100000),
    CONSTRAINT simulation_wse_datum_nonempty CHECK (length(trim(vertical_datum)) > 0),
    CONSTRAINT simulation_wse_status CHECK (review_status IN ('PENDING_REVIEW', 'VERIFIED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS simulation_wse_scenario_idx
    ON hydrology.simulation_wse (scenario_id, created_at DESC);

COMMENT ON TABLE hydrology.simulation_wse IS
'Scenario/model water-surface elevations. Not FEMA regulatory evidence and never a replacement for effective BFE/zone records.';
