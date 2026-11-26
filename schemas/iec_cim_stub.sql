-- IEC 61970 / 61968 CIM topology stub for TSM power grid tier
-- CEII / utility-proprietary data MUST live in isolated OIDC-authenticated schema.
-- Public HIFLD geometry only in public tier; no feeder/customer linkage here.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS cim_public;   -- HIFLD screening only
CREATE SCHEMA IF NOT EXISTS cim_ceii;    -- NDA / CEII restricted (RBAC enforced externally)

CREATE TABLE IF NOT EXISTS cim_public.transmission_line (
  line_id           TEXT PRIMARY KEY,
  name              TEXT,
  voltage_kv        DOUBLE PRECISION,
  owner             TEXT,
  status            TEXT,
  geom              geometry(MultiLineString, 26916),
  source            TEXT DEFAULT 'HIFLD',
  last_checked      DATE,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS cim_public.substation (
  sub_id            TEXT PRIMARY KEY,
  name              TEXT,
  voltage_kv        DOUBLE PRECISION,
  owner             TEXT,
  geom              geometry(Point, 26916),
  pad_elev_navd88_m DOUBLE PRECISION,
  source            TEXT DEFAULT 'HIFLD',
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cim_line_geom ON cim_public.transmission_line USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_cim_sub_geom ON cim_public.substation USING GIST (geom);

CREATE TABLE IF NOT EXISTS cim_ceii.feeder (
  feeder_id         TEXT PRIMARY KEY,
  sub_id            TEXT,
  nominal_kv        DOUBLE PRECISION,
  phase_config      TEXT,
  conductor_ampacity DOUBLE PRECISION,
  geom              geometry(MultiLineString, 26916),
  protection_zone   TEXT,
  scada_read_only   BOOLEAN NOT NULL DEFAULT TRUE,
  nda_reference     TEXT NOT NULL,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON SCHEMA cim_ceii IS
  'CEII / utility NDA data only. Access via OIDC + audit log. ADR-004: SCADA read-only.';
