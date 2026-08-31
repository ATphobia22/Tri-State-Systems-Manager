-- FEMA FIRM source/derivative separation.
-- A FIRM source record may exist without georeferencing; derivatives require validated source evidence.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS firm_panel (
  panel_id                 TEXT PRIMARY KEY,
  community_name           TEXT NOT NULL,
  effective_date           DATE,
  source_artifact_id       TEXT NOT NULL REFERENCES evidence_artifacts(artifact_id),
  horizontal_crs           TEXT,
  vertical_reference       TEXT,
  validation_status        TEXT NOT NULL CHECK (validation_status IN (
    'pending','validated','provisional','failed_closed','rejected','stale'
  )),
  footprint                geometry(Polygon, 4326),
  source_metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS firm_derivative (
  derivative_id            TEXT PRIMARY KEY,
  panel_id                 TEXT NOT NULL REFERENCES firm_panel(panel_id),
  artifact_id              TEXT NOT NULL REFERENCES evidence_artifacts(artifact_id),
  source_evidence_ids      TEXT[] NOT NULL,
  transformation_chain     JSONB NOT NULL DEFAULT '[]'::jsonb,
  derivation_class         TEXT NOT NULL,
  software_version         TEXT NOT NULL,
  validation_status        TEXT NOT NULL CHECK (validation_status IN (
    'pending','validated','provisional','failed_closed','rejected','stale'
  )),
  public_release           BOOLEAN NOT NULL DEFAULT FALSE,
  geometry                 geometry(Geometry, 4326),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_firm_panel_geom ON firm_panel USING GIST (footprint);
CREATE INDEX IF NOT EXISTS idx_firm_derivative_geom ON firm_derivative USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_firm_derivative_panel ON firm_derivative (panel_id);

-- Public derivatives cannot be released when the parent panel failed georeferencing validation.
CREATE OR REPLACE FUNCTION prevent_unvalidated_firm_public_release()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status TEXT;
BEGIN
  IF NEW.public_release THEN
    SELECT validation_status INTO parent_status
      FROM firm_panel
      WHERE panel_id = NEW.panel_id;
    IF parent_status <> 'validated' THEN
      RAISE EXCEPTION 'fail-closed: FIRM panel % is not validated', NEW.panel_id;
    END IF;
    IF NEW.validation_status <> 'validated' THEN
      RAISE EXCEPTION 'fail-closed: FIRM derivative % is not validated', NEW.derivative_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_firm_public_release ON firm_derivative;
CREATE TRIGGER trg_firm_public_release
BEFORE INSERT OR UPDATE ON firm_derivative
FOR EACH ROW EXECUTE FUNCTION prevent_unvalidated_firm_public_release();
