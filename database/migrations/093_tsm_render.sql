-- Render / 3D tiles provenance (Pages + offline). Not authoritative elevation.
CREATE TABLE IF NOT EXISTS tsm_render_artifact (
  artifact_id        TEXT PRIMARY KEY,
  kind               TEXT NOT NULL, -- terrain-rgb | building-3d-tiles | mvt | pmtiles
  crs_epsg           INTEGER NOT NULL DEFAULT 3857,
  vertical_datum     TEXT, -- NAVD88 when elevation-bearing; NULL for pure basemap
  is_authoritative   BOOLEAN NOT NULL DEFAULT FALSE,
  content_sha256     TEXT NOT NULL,
  source_manifest    JSONB NOT NULL DEFAULT '{}'::jsonb,
  storage_uri        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN tsm_render_artifact.is_authoritative IS
  'FALSE for Apple/MapLibre basemaps; TRUE only for USGS 3DEP / surveyed packages with human seal';
