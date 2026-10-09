-- Shared TSM/UACF application schema. Run after 000_bootstrap.sql.
BEGIN;
CREATE SCHEMA IF NOT EXISTS tsm;
CREATE SCHEMA IF NOT EXISTS uacf;
CREATE TABLE IF NOT EXISTS tsm.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  checksum_sha256 char(64),
  applied_by text NOT NULL DEFAULT current_user
);
CREATE TABLE IF NOT EXISTS tsm.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_subject text UNIQUE NOT NULL,
  email text,
  display_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','pending')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tsm_users_status_idx ON tsm.users(status);
CREATE TABLE IF NOT EXISTS tsm.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES tsm.users(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','disabled')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO tsm.schema_migrations(version) VALUES ('005_tsm_core') ON CONFLICT DO NOTHING;
COMMIT;
