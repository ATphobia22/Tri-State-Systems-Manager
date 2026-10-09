BEGIN;
CREATE TABLE IF NOT EXISTS uacf.providers (
  id text PRIMARY KEY,
  kind text NOT NULL,
  endpoint_origin text,
  enabled boolean NOT NULL DEFAULT false,
  secret_reference text,
  policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (endpoint_origin IS NULL OR endpoint_origin ~ '^https?://[^/]+/?$')
);
-- Store secret references only; never store raw credentials here.
INSERT INTO tsm.schema_migrations(version) VALUES ('011_providers') ON CONFLICT DO NOTHING;
COMMIT;
