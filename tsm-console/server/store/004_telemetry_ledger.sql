-- TSM telemetry provenance ledger. Hash integrity proves lineage; it does not
-- establish scientific truth, regulatory authority, or professional certification.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS tsm_telemetry_ledger;

CREATE TABLE IF NOT EXISTS tsm_telemetry_ledger.sensor_streams (
  stream_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_identifier TEXT NOT NULL UNIQUE,
  sensor_domain TEXT NOT NULL,
  coordinate_location geometry(Point, 2966),
  base_elevation_navd88_ft NUMERIC(10,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tsm_telemetry_ledger.state_ledger (
  entry_sequence BIGSERIAL PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES tsm_telemetry_ledger.sensor_streams(stream_id),
  recorded_at TIMESTAMPTZ NOT NULL,
  raw_metric_value NUMERIC(14,6) NOT NULL,
  calculated_wse_navd88_ft NUMERIC(14,6),
  operator_sub_identity TEXT NOT NULL,
  system_execution_state TEXT NOT NULL CHECK (system_execution_state IN ('STABLE','ACTION_REQUIRED','CRITICAL')),
  nonce TEXT NOT NULL CHECK (nonce ~ '^[a-f0-9]{32}$'),
  parent_hash CHAR(64) NOT NULL CHECK (parent_hash ~ '^[a-f0-9]{64}$'),
  prov_sha256_hash CHAR(64) NOT NULL UNIQUE CHECK (prov_sha256_hash ~ '^[a-f0-9]{64}$'),
  canonical_payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tsm_ledger_stream_time ON tsm_telemetry_ledger.state_ledger (stream_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tsm_ledger_parent_hash ON tsm_telemetry_ledger.state_ledger (parent_hash);

CREATE OR REPLACE FUNCTION tsm_telemetry_ledger.append_state_ledger(
  p_stream_id UUID, p_recorded_at TIMESTAMPTZ, p_raw_metric_value NUMERIC,
  p_calculated_wse_navd88_ft NUMERIC, p_operator_sub_identity TEXT,
  p_system_execution_state TEXT, p_nonce TEXT
)
RETURNS tsm_telemetry_ledger.state_ledger
LANGUAGE plpgsql
AS $$
DECLARE previous_hash CHAR(64); canonical TEXT; new_hash CHAR(64); inserted_row tsm_telemetry_ledger.state_ledger;
BEGIN
  IF p_nonce !~ '^[a-f0-9]{32}$' THEN RAISE EXCEPTION 'invalid nonce'; END IF;
  IF p_system_execution_state NOT IN ('STABLE','ACTION_REQUIRED','CRITICAL') THEN RAISE EXCEPTION 'invalid system execution state'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('tsm_telemetry_ledger:global-head', 0));
  SELECT prov_sha256_hash INTO previous_hash FROM tsm_telemetry_ledger.state_ledger ORDER BY entry_sequence DESC LIMIT 1 FOR UPDATE;
  previous_hash := COALESCE(previous_hash, repeat('0', 64));
  canonical := concat_ws('|', p_stream_id::text, to_char(p_recorded_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(p_raw_metric_value,'FM9999999990.000000'), coalesce(to_char(p_calculated_wse_navd88_ft,'FM9999999990.000000'),''), p_operator_sub_identity, p_system_execution_state, previous_hash, p_nonce);
  new_hash := encode(digest(canonical,'sha256'),'hex');
  INSERT INTO tsm_telemetry_ledger.state_ledger (stream_id,recorded_at,raw_metric_value,calculated_wse_navd88_ft,operator_sub_identity,system_execution_state,nonce,parent_hash,prov_sha256_hash,canonical_payload)
  VALUES (p_stream_id,p_recorded_at,p_raw_metric_value,p_calculated_wse_navd88_ft,p_operator_sub_identity,p_system_execution_state,p_nonce,previous_hash,new_hash,canonical)
  RETURNING * INTO inserted_row;
  RETURN inserted_row;
END;
$$;
