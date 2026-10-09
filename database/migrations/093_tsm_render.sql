BEGIN;
CREATE TABLE IF NOT EXISTS tsm.render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  input_artifact_id uuid NOT NULL REFERENCES tsm.artifacts(id) ON DELETE RESTRICT,
  output_artifact_id uuid REFERENCES tsm.artifacts(id) ON DELETE RESTRICT,
  renderer text NOT NULL,
  renderer_version text NOT NULL,
  status text NOT NULL CHECK(status IN ('queued','running','succeeded','failed','cancelled')),
  diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
INSERT INTO tsm.schema_migrations(version) VALUES ('093_tsm_render') ON CONFLICT DO NOTHING;
COMMIT;
