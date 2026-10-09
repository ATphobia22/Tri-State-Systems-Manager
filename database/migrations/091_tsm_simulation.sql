-- Simulation snapshots are DERIVED, never AUTHORITATIVE regulatory determinations.
CREATE TABLE IF NOT EXISTS tsm_simulation_run (
  run_id             TEXT PRIMARY KEY,
  model_family       TEXT NOT NULL, -- HEC-RAS | MODFLOW | SWMM | OTHER
  model_version      TEXT,
  scenario_label     TEXT NOT NULL,
  is_simulation_demo BOOLEAN NOT NULL DEFAULT TRUE,
  cfl_ok             BOOLEAN,
  mass_error_pct     DOUBLE PRECISION,
  governor_passed    BOOLEAN NOT NULL DEFAULT FALSE,
  daubert_certified  BOOLEAN NOT NULL DEFAULT FALSE,
  human_authorized   BOOLEAN NOT NULL DEFAULT FALSE,
  reviewer_identity  TEXT,
  review_reason      TEXT,
  reviewed_at        TIMESTAMPTZ,
  metrics_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_sha256     TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tsm_sim_human_auth CHECK (
    human_authorized = FALSE
    OR (reviewer_identity IS NOT NULL AND review_reason IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS tsm_simulation_mesh_centroid (
  id                 BIGSERIAL PRIMARY KEY,
  run_id             TEXT NOT NULL REFERENCES tsm_simulation_run(run_id) ON DELETE CASCADE,
  cell_id            TEXT NOT NULL,
  geom               geometry(Point, 2966),
  wse_ft_navd88      DOUBLE PRECISION,
  depth_ft           DOUBLE PRECISION,
  velocity_fps       DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS tsm_sim_mesh_run ON tsm_simulation_mesh_centroid (run_id);
