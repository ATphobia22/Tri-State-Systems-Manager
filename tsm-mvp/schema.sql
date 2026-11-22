-- MVP-1: only the kernel writes these tables. Run once with psql -v ON_ERROR_STOP=1.
CREATE SCHEMA IF NOT EXISTS synchronization;
CREATE SCHEMA IF NOT EXISTS read_model;
CREATE TABLE IF NOT EXISTS synchronization.evidence (
  evidence_id TEXT PRIMARY KEY,
  authority TEXT NOT NULL CHECK (authority = 'USGS'),
  source_uri TEXT NOT NULL,
  sha256 CHAR(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  retrieved_at TIMESTAMPTZ NOT NULL,
  raw_bytes BYTEA NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'UNREVIEWED' CHECK (review_status IN ('UNREVIEWED','REVIEWED','REJECTED'))
);
CREATE TABLE IF NOT EXISTS synchronization.event_store (
  event_id UUID PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_version BIGINT NOT NULL CHECK (aggregate_version > 0),
  event_type TEXT NOT NULL CHECK (event_type = 'ObservationReceived'),
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_system TEXT NOT NULL CHECK (source_system = 'USGS'),
  schema_version TEXT NOT NULL CHECK (schema_version = '1.0.0'),
  evidence_id TEXT NOT NULL REFERENCES synchronization.evidence(evidence_id),
  payload JSONB NOT NULL,
  UNIQUE (aggregate_type, aggregate_id, aggregate_version)
);
CREATE TABLE IF NOT EXISTS synchronization.event_processing_log (
  event_id UUID PRIMARY KEY REFERENCES synchronization.event_store(event_id),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS read_model.current_hydrology (
  station_id TEXT PRIMARY KEY,
  stage_ft DOUBLE PRECISION NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  vertical_datum TEXT NOT NULL CHECK (vertical_datum = 'GAGE_DATUM'),
  quality TEXT NOT NULL,
  evidence_id TEXT NOT NULL REFERENCES synchronization.evidence(evidence_id),
  source_event UUID NOT NULL REFERENCES synchronization.event_store(event_id),
  aggregate_version BIGINT NOT NULL,
  longitude DOUBLE PRECISION,
  latitude DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- An append-only accepted-event log: no event mutation or removal by application roles.
CREATE OR REPLACE FUNCTION synchronization.deny_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'event_store is append only';
END; $$;
DROP TRIGGER IF EXISTS event_store_immutable ON synchronization.event_store;
CREATE TRIGGER event_store_immutable BEFORE UPDATE OR DELETE
ON synchronization.event_store FOR EACH ROW EXECUTE FUNCTION synchronization.deny_event_mutation();
