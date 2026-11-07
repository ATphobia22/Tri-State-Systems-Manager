-- Vertical datums reference table (Phase-1 geodesy vocabulary).
-- Seeds the datum identifiers used by packages/geo/src/geodesy/VerticalDatum.ts
-- so the database carries the same controlled vocabulary as the code.
-- UNKNOWN is intentionally NOT seeded: it is a sentinel for missing data,
-- not a datum. Safe to re-run: IF NOT EXISTS + ON CONFLICT DO NOTHING.
BEGIN;
CREATE TABLE IF NOT EXISTS tsm.vertical_datums (
  datum_id text PRIMARY KEY,
  datum_name text NOT NULL,
  authority text,
  description text,
  height_type text NOT NULL CHECK (height_type IN ('ORTHOMETRIC', 'ELLIPSOIDAL', 'TIDAL', 'GAGE_STAGE')),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO tsm.vertical_datums (datum_id, datum_name, authority, description, height_type) VALUES
  ('NAVD88', 'North American Vertical Datum of 1988', 'NOAA', 'Orthometric height system for North America, realized by leveling constrained to Father Point, Rimouski.', 'ORTHOMETRIC'),
  ('NGVD29', 'National Geodetic Vertical Datum of 1929', 'NOAA', 'Superseded orthometric datum (formerly Sea Level Datum of 1929). Do not mix with NAVD88 without a published transform; the shift varies by location.', 'ORTHOMETRIC'),
  ('ELLIPSOID', 'Ellipsoidal height', 'GNSS', 'Height above the reference ellipsoid (e.g. GRS80 via NAD83(2011)). Not an orthometric height.', 'ELLIPSOIDAL'),
  ('MLLW', 'Mean Lower Low Water', 'NOAA', 'Tidal datum: average of the lower low water heights.', 'TIDAL'),
  ('MHW', 'Mean High Water', 'NOAA', 'Tidal datum: average of the high water heights.', 'TIDAL'),
  ('GAGE_DATUM', 'Local gage datum', 'Agency', 'Station-specific local datum. Water surface elevation equals stage plus the gage datum elevation in NAVD88.', 'GAGE_STAGE')
ON CONFLICT (datum_id) DO NOTHING;
INSERT INTO tsm.schema_migrations(version) VALUES ('098_tsm_vertical_datums') ON CONFLICT DO NOTHING;
COMMIT;
