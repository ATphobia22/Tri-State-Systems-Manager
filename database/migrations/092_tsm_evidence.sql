BEGIN;
CREATE TABLE IF NOT EXISTS tsm.evidence_links (
  source_evidence_id uuid NOT NULL REFERENCES tsm.evidence_records(id) ON DELETE RESTRICT,
  derived_evidence_id uuid NOT NULL REFERENCES tsm.evidence_records(id) ON DELETE RESTRICT,
  derivation_method text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(source_evidence_id, derived_evidence_id),
  CHECK(source_evidence_id <> derived_evidence_id)
);
INSERT INTO tsm.schema_migrations(version) VALUES ('092_tsm_evidence') ON CONFLICT DO NOTHING;
COMMIT;
