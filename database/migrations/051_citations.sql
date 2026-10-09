BEGIN;
CREATE TABLE IF NOT EXISTS tsm.citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL REFERENCES tsm.evidence_records(id) ON DELETE RESTRICT,
  locator text NOT NULL,
  quote_sha256 char(64),
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS citations_evidence_idx ON tsm.citations(evidence_id);
INSERT INTO tsm.schema_migrations(version) VALUES ('051_citations') ON CONFLICT DO NOTHING;
COMMIT;
