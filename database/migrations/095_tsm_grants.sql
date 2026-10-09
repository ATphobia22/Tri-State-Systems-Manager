BEGIN;
CREATE TABLE IF NOT EXISTS tsm.grant_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL,
  title text NOT NULL,
  sponsor text NOT NULL,
  official_url text NOT NULL,
  open_date date,
  close_date date,
  status text NOT NULL CHECK(status IN ('unverified','open','upcoming','closed','cancelled')),
  last_verified_at timestamptz,
  evidence_id uuid REFERENCES tsm.evidence_records(id) ON DELETE RESTRICT,
  eligibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  required_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, official_url)
);
CREATE INDEX IF NOT EXISTS grants_status_close_idx ON tsm.grant_opportunities(status, close_date);
INSERT INTO tsm.schema_migrations(version) VALUES ('095_tsm_grants') ON CONFLICT DO NOTHING;
COMMIT;
