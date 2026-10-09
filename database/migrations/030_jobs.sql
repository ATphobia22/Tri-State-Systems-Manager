BEGIN;
CREATE TABLE IF NOT EXISTS uacf.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES uacf.workflows(id) ON DELETE SET NULL,
  capability_id text REFERENCES uacf.capabilities(id) ON DELETE RESTRICT,
  idempotency_key text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  input_digest char(64) NOT NULL,
  result_digest char(64),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  UNIQUE (capability_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS jobs_status_created_idx ON uacf.jobs(status, created_at);
INSERT INTO tsm.schema_migrations(version) VALUES ('030_jobs') ON CONFLICT DO NOTHING;
COMMIT;
