-- TSM hydrology plane (PostGIS). Fail-closed: gage_zero_navd88_ft NULL means conversion unpublished.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS tsm_gage_station (
  site_no            TEXT PRIMARY KEY,
  agency             TEXT NOT NULL DEFAULT 'USGS',
  name               TEXT NOT NULL,
  geom               geometry(Point, 4326),
  gage_zero_navd88_ft DOUBLE PRECISION,
  conversion_published BOOLEAN NOT NULL DEFAULT FALSE,
  notes              TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tsm_gage_zero_requires_flag CHECK (
    (gage_zero_navd88_ft IS NULL AND conversion_published = FALSE)
    OR (gage_zero_navd88_ft IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS tsm_gage_observation (
  id                 BIGSERIAL PRIMARY KEY,
  site_no            TEXT NOT NULL REFERENCES tsm_gage_station(site_no),
  observed_at        TIMESTAMPTZ NOT NULL,
  gage_height_ft     DOUBLE PRECISION,
  discharge_cfs      DOUBLE PRECISION,
  quality_flag       TEXT NOT NULL DEFAULT 'unknown',
  source_uri         TEXT,
  content_sha256     TEXT,
  rejected           BOOLEAN NOT NULL DEFAULT FALSE,
  reject_reason      TEXT,
  UNIQUE (site_no, observed_at)
);

CREATE INDEX IF NOT EXISTS tsm_gage_obs_site_time ON tsm_gage_observation (site_no, observed_at DESC);

-- Seed known Tri-State sites without publishing conversion (altitude metadata only).
INSERT INTO tsm_gage_station (site_no, name, gage_zero_navd88_ft, conversion_published, notes)
VALUES
  ('03378500', 'Wabash River at New Harmony, IN', 352.71, FALSE, 'USGS altitude metadata; conversionPublished=false until human verify'),
  ('03322000', 'Ohio River at Evansville, IN', 328.38, FALSE, 'USGS altitude metadata; conversionPublished=false until human verify')
ON CONFLICT (site_no) DO NOTHING;
