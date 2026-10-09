-- 093_tsm_render.sql — TSM render/cinematic domain tables.
-- Presentation boundary: a visualization can never silently become evidence.
CREATE TABLE IF NOT EXISTS tsm_render_recipes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, recipe JSONB NOT NULL, deterministic_seed BIGINT, provenance JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS tsm_render_jobs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), recipe_id UUID NOT NULL REFERENCES tsm_render_recipes(id), status TEXT NOT NULL DEFAULT 'queued', output_ref TEXT, provenance JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
