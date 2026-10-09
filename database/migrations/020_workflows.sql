BEGIN;
CREATE TABLE IF NOT EXISTS uacf.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES tsm.projects(id) ON DELETE RESTRICT,
  name text NOT NULL,
  definition jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO tsm.schema_migrations(version) VALUES ('020_workflows') ON CONFLICT DO NOTHING;
COMMIT;
