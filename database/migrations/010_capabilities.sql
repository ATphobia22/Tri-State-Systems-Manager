BEGIN;
CREATE TABLE IF NOT EXISTS uacf.capabilities (
  id text PRIMARY KEY,
  version text NOT NULL,
  input_schema jsonb NOT NULL,
  output_schema jsonb NOT NULL,
  required_scopes text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT false,
  timeout_ms integer NOT NULL DEFAULT 30000 CHECK (timeout_ms BETWEEN 1 AND 300000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO tsm.schema_migrations(version) VALUES ('010_capabilities') ON CONFLICT DO NOTHING;
COMMIT;
