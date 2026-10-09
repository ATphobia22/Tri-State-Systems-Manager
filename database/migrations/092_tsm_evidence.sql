-- 092_tsm_evidence.sql — TSM engineering-evidence domain tables.
-- Evidence pipeline: observation -> derived -> model I/O -> review-ready ->
-- engineer acceptance -> agency acceptance. Missing evidence stays visible.
CREATE TABLE IF NOT EXISTS tsm_evidence_packets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), packet_type TEXT NOT NULL, stage TEXT NOT NULL, sha256 TEXT NOT NULL UNIQUE, payload JSONB NOT NULL, human_review_status TEXT NOT NULL DEFAULT 'pending', provenance JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS tsm_evidence_review (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), packet_id UUID NOT NULL REFERENCES tsm_evidence_packets(id), reviewer TEXT NOT NULL, decision TEXT NOT NULL, notes TEXT, provenance JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
