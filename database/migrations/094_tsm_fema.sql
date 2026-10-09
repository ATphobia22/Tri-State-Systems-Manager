-- 094_tsm_fema.sql — TSM FEMA regulatory domain tables.
-- FEMA NFHL effective products and Indiana DNR BAFM stay separate authority
-- planes; neither is silently promoted to the other.
CREATE TABLE IF NOT EXISTS tsm_fema_panels (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), panel_number TEXT NOT NULL, effective_date DATE, community_id TEXT, vintage JSONB NOT NULL DEFAULT '{}', provenance JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (panel_number, effective_date));
CREATE TABLE IF NOT EXISTS tsm_loma_cases (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), case_number TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'open', bfe_ft_navd88 DOUBLE PRECISION, lag_ft_owner_supplied DOUBLE PRECISION, provenance JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
