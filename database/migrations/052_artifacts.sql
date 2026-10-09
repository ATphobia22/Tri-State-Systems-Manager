BEGIN;
CREATE TABLE IF NOT EXISTS tsm.artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES tsm.projects(id) ON DELETE RESTRICT,
  artifact_type text NOT NULL,
  storage_uri text NOT NULL,
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  byte_length bigint NOT NULL CHECK (byte_length >= 0),
  media_type text NOT NULL,
  source_commit text,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS artifacts_project_created_idx ON tsm.artifacts(project_id, created_at DESC);
INSERT INTO tsm.schema_migrations(version) VALUES ('052_artifacts') ON CONFLICT DO NOTHING;
COMMIT;
