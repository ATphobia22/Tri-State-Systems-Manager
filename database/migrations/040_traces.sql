BEGIN;
CREATE TABLE IF NOT EXISTS uacf.traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES uacf.jobs(id) ON DELETE CASCADE,
  parent_span_id uuid,
  span_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'unset' CHECK (status IN ('unset','ok','error')),
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS traces_job_started_idx ON uacf.traces(job_id, started_at);
INSERT INTO tsm.schema_migrations(version) VALUES ('040_traces') ON CONFLICT DO NOTHING;
COMMIT;
