BEGIN;
CREATE TABLE IF NOT EXISTS tsm.simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES tsm.projects(id) ON DELETE RESTRICT,
  model_name text NOT NULL,
  model_version text NOT NULL,
  input_artifact_id uuid REFERENCES tsm.artifacts(id) ON DELETE RESTRICT,
  output_artifact_id uuid REFERENCES tsm.artifacts(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK(status IN ('queued','running','succeeded','failed','cancelled')),
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO tsm.schema_migrations(version) VALUES ('091_tsm_simulation') ON CONFLICT DO NOTHING;
COMMIT;
