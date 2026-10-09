BEGIN;
CREATE TABLE IF NOT EXISTS tsm.hydrology_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id text NOT NULL,
  observed_at timestamptz NOT NULL,
  parameter_code text NOT NULL,
  value numeric NOT NULL,
  unit text NOT NULL,
  datum text,
  source_evidence_id uuid REFERENCES tsm.evidence_records(id) ON DELETE RESTRICT,
  quality_flag text NOT NULL DEFAULT 'unreviewed',
  UNIQUE(station_id, observed_at, parameter_code, source_evidence_id)
);
CREATE INDEX IF NOT EXISTS hydrology_station_time_idx ON tsm.hydrology_observations(station_id, observed_at DESC);
INSERT INTO tsm.schema_migrations(version) VALUES ('090_tsm_hydrology') ON CONFLICT DO NOTHING;
COMMIT;
