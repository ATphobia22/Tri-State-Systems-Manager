-- SQL reference for file-store era. Optional Prisma path: ../../prisma/schema.prisma
-- TSM Authoritative Evidence Store
-- PostGIS-ready. Phase 1 may run on SQLite/JSON; production targets PostgreSQL + PostGIS.
-- SHA-256 proves integrity only — not scientific truth or FRE 702 admissibility.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS evidence_artifacts (
  artifact_id            TEXT PRIMARY KEY,
  artifact_type          TEXT NOT NULL,
  source_authority       TEXT NOT NULL,
  source_uri             TEXT NOT NULL,
  source_identifier      TEXT,
  retrieved_at           TIMESTAMPTZ NOT NULL,
  observation_time       TIMESTAMPTZ,
  horizontal_crs         TEXT NOT NULL,  -- e.g. EPSG:2966
  horizontal_crs_name    TEXT,
  vertical_datum         TEXT NOT NULL,  -- e.g. NAVD88 — never conflate with CRS
  source_version         TEXT,
  content_hash_sha256    CHAR(64) NOT NULL CHECK (content_hash_sha256 ~ '^[a-f0-9]{64}$'),
  parent_artifacts       TEXT[] DEFAULT '{}',
  transformation_chain   JSONB DEFAULT '[]',
  validation_status      TEXT NOT NULL CHECK (validation_status IN (
    'pending','validated','rejected','stale','provisional','failed_closed'
  )),
  uncertainty            JSONB,
  authority_class        TEXT NOT NULL CHECK (authority_class IN (
    'OBSERVATION','FORECAST','REGULATORY','DERIVED','MODEL_OUTPUT',
    'INFERENCE','VISUALIZATION','SIMULATION_DEMO'
  )),
  derivation_class       TEXT NOT NULL,
  model_version          TEXT,
  software_version       TEXT,
  operator_or_service_identity TEXT,
  governance_status      TEXT NOT NULL CHECK (governance_status IN (
    'draft','human_review_required','human_authorized','published','superseded','withdrawn'
  )),
  supersedes             TEXT,
  superseded_by          TEXT,
  is_simulation_demo     BOOLEAN NOT NULL DEFAULT FALSE,
  human_review_status    TEXT,
  notes                  TEXT,
  payload                JSONB,
  geom                   geometry(Geometry, 4326),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_hash_sha256)
);

CREATE INDEX IF NOT EXISTS idx_evidence_authority ON evidence_artifacts (source_authority);
CREATE INDEX IF NOT EXISTS idx_evidence_class ON evidence_artifacts (authority_class);
CREATE INDEX IF NOT EXISTS idx_evidence_retrieved ON evidence_artifacts (retrieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_demo ON evidence_artifacts (is_simulation_demo);

-- Append-only audit of hash verification events
CREATE TABLE IF NOT EXISTS provenance_verifications (
  id                     BIGSERIAL PRIMARY KEY,
  artifact_id            TEXT NOT NULL REFERENCES evidence_artifacts(artifact_id),
  expected_hash          CHAR(64) NOT NULL,
  computed_hash          CHAR(64) NOT NULL,
  match                  BOOLEAN NOT NULL,
  verified_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  verifier               TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS merkle_roots (
  version                BIGSERIAL PRIMARY KEY,
  root_hash              CHAR(64) NOT NULL,
  leaf_count             INTEGER NOT NULL,
  computed_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
