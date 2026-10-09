-- 091_tsm_simulation.sql — TSM simulation domain tables.
-- Only historical flood and berm/road-placement simulations are permitted.
-- Every run is deterministic (seeded) and labeled SIMULATED or SCENARIO.
CREATE TABLE IF NOT EXISTS tsm_sim_runs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), scenario_type TEXT NOT NULL CHECK (scenario_type IN ('historical_flood', 'berm_placement', 'road_placement')), seed BIGINT NOT NULL, parameters JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'pending', provenance JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS tsm_sim_results (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), run_id UUID NOT NULL REFERENCES tsm_sim_runs(id), result_hash TEXT NOT NULL, depth_grid_ref TEXT, wse_navd88_ft DOUBLE PRECISION, provenance JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
