-- TSM Extended Data / Regulatory Planes
-- PostgreSQL 16 + PostGIS 3.4 target.
-- Regulatory values are versioned evidence inputs, not legal determinations.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS data_catalog;
CREATE SCHEMA IF NOT EXISTS telemetry;
CREATE SCHEMA IF NOT EXISTS regulatory;

DO $$
BEGIN
  CREATE TYPE regulatory.rule_jurisdiction AS ENUM ('INDIANA', 'ILLINOIS', 'KENTUCKY', 'FEDERAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE regulatory.finding_status AS ENUM ('COMPLIANT', 'NON_COMPLIANT', 'REVIEW_REQUIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS telemetry.usgs_gauges (
  station_id TEXT PRIMARY KEY,
  station_name TEXT NOT NULL,
  latitude NUMERIC(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  gauge_zero_navd88_ft NUMERIC(10,3),
  geom geometry(Point, 2966),
  source_uri TEXT NOT NULL DEFAULT 'https://waterdata.usgs.gov/',
  authority_class TEXT NOT NULL DEFAULT 'OBSERVATION',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usgs_gauges_geom ON telemetry.usgs_gauges USING GIST (geom);

CREATE TABLE IF NOT EXISTS telemetry.gauge_observations (
  observation_id BIGSERIAL PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES telemetry.usgs_gauges(station_id),
  parameter_code CHAR(5) NOT NULL,
  observed_value NUMERIC(14,6) NOT NULL,
  unit_code TEXT,
  quality_code TEXT NOT NULL,
  observation_timestamp TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_hash_sha256 CHAR(64) NOT NULL CHECK (content_hash_sha256 ~ '^[a-f0-9]{64}$'),
  evidence_artifact_id TEXT,
  UNIQUE (station_id, parameter_code, observation_timestamp, content_hash_sha256)
);

CREATE INDEX IF NOT EXISTS idx_observations_station_time
  ON telemetry.gauge_observations (station_id, observation_timestamp DESC);

CREATE TABLE IF NOT EXISTS data_catalog.sediment_cores (
  core_id TEXT PRIMARY KEY,
  site_name TEXT NOT NULL,
  latitude NUMERIC(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  elevation_m NUMERIC(10,3),
  dataset_doi TEXT,
  source_uri TEXT,
  geom geometry(Point, 2966),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sediment_cores_geom
  ON data_catalog.sediment_cores USING GIST (geom);

CREATE TABLE IF NOT EXISTS data_catalog.xrf_geochemical_profiles (
  profile_id BIGSERIAL PRIMARY KEY,
  core_id TEXT NOT NULL REFERENCES data_catalog.sediment_cores(core_id) ON DELETE CASCADE,
  depth_cm NUMERIC(10,3) NOT NULL CHECK (depth_cm >= 0),
  estimated_age_ce INTEGER,
  magnesium_ppm NUMERIC(12,3),
  aluminum_ppm NUMERIC(12,3),
  silicon_ppm NUMERIC(12,3),
  calcium_ppm NUMERIC(12,3),
  titanium_ppm NUMERIC(12,3),
  manganese_ppm NUMERIC(12,3),
  iron_ppm NUMERIC(12,3),
  silicon_titanium_ratio NUMERIC(14,6),
  manganese_iron_ratio NUMERIC(14,6),
  source_artifact_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_xrf_core_depth
  ON data_catalog.xrf_geochemical_profiles (core_id, depth_cm);

CREATE TABLE IF NOT EXISTS regulatory.versioned_rulesets (
  rule_id TEXT PRIMARY KEY,
  jurisdiction regulatory.rule_jurisdiction NOT NULL,
  statute_citation TEXT NOT NULL,
  rule_title TEXT,
  surcharge_ceiling_ft NUMERIC(8,4),
  source_uri TEXT NOT NULL,
  source_version TEXT,
  effective_date DATE,
  verified_at TIMESTAMPTZ,
  verification_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (verification_status IN ('PENDING', 'VERIFIED', 'SUPERSEDED', 'WITHDRAWN')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS regulatory.findings (
  finding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT NOT NULL REFERENCES regulatory.versioned_rulesets(rule_id),
  plan_id TEXT NOT NULL,
  observed_value NUMERIC(14,6),
  threshold_value NUMERIC(14,6),
  status regulatory.finding_status NOT NULL DEFAULT 'REVIEW_REQUIRED',
  evidence_artifact_id TEXT,
  rationale TEXT NOT NULL,
  human_reviewer TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regulatory_findings_plan
  ON regulatory.findings (plan_id, created_at DESC);

-- Authoritative-source seeds verified against current official pages during the TSM policy review.
-- Indiana: DNR states a 0.14 ft cumulative surcharge regulatory criterion while its rule definition
-- describes >=0.15 ft as adverse floodway impact; TSM must retain both concepts distinctly.
INSERT INTO regulatory.versioned_rulesets
  (rule_id, jurisdiction, statute_citation, rule_title, surcharge_ceiling_ft, source_uri, source_version, verification_status)
VALUES
  ('IN-FCA-01', 'INDIANA', 'IC 14-28-1 / 312 IAC 10', 'Indiana Flood Control Act / Floodplain Management', 0.1400,
   'https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/no-rise/', '2026-official-page', 'VERIFIED'),
  ('IL-FWE-01', 'ILLINOIS', '17 Ill. Adm. Code 3700', 'Construction in Floodways of Rivers, Lakes and Streams', 0.1000,
   'https://dnr.illinois.gov/content/dam/soi/en/web/dnr/adrules/documents/17-3700.pdf', '2014-rule-text', 'VERIFIED'),
  ('KY-RCR-01', 'KENTUCKY', '401 KAR 4:060', 'Stream construction criteria', NULL,
   'https://apps.legislature.ky.gov/law/kar/downloads/docs/3581/document.engrossed.pdf', 'official-rule-text', 'VERIFIED')
ON CONFLICT (rule_id) DO UPDATE SET
  source_uri = EXCLUDED.source_uri,
  source_version = EXCLUDED.source_version,
  verification_status = EXCLUDED.verification_status,
  surcharge_ceiling_ft = EXCLUDED.surcharge_ceiling_ft,
  updated_at = now();
