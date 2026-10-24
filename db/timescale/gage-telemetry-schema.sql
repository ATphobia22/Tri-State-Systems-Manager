-- Optional TimescaleDB hypertable for station gage metrics.
-- Complements PostGIS; does not replace the evidence ledger.
-- Apply only when Timescale extension is available:
--   CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS tsm_gage_observation (
  time            TIMESTAMPTZ       NOT NULL,
  site_no         TEXT              NOT NULL,
  parameter_code  TEXT              NOT NULL DEFAULT '00065',
  value_ft        DOUBLE PRECISION,
  value_raw       DOUBLE PRECISION,
  qualifiers      TEXT,
  source          TEXT              NOT NULL DEFAULT 'usgs',
  vertical_datum  TEXT,
  gage_datum_ft   DOUBLE PRECISION,
  ingested_at     TIMESTAMPTZ       NOT NULL DEFAULT now()
);

SELECT create_hypertable('tsm_gage_observation', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS tsm_gage_observation_site_time_idx
  ON tsm_gage_observation (site_no, time DESC);

COMMENT ON TABLE tsm_gage_observation IS
  'Informational gage telemetry. Not a regulatory stage determination. Explicit vertical_datum required when promoting to evidence.';
