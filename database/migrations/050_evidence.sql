BEGIN;
CREATE TABLE IF NOT EXISTS tsm.evidence_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES tsm.projects(id) ON DELETE RESTRICT,
  source_uri text NOT NULL,
  source_sha256 char(64) NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  authority_class text NOT NULL CHECK (authority_class IN ('observation','derived','model_output','simulation_demo','visualization')),
  derivation_class text NOT NULL CHECK (derivation_class IN ('raw','transformed','modeled','rendered')),
  observed_at timestamptz,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS evidence_project_ingested_idx ON tsm.evidence_records(project_id, ingested_at DESC);
INSERT INTO tsm.schema_migrations(version) VALUES ('050_evidence') ON CONFLICT DO NOTHING;
COMMIT;
