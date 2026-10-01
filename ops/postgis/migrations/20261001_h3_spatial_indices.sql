-- TSM PostGIS/H3 spatial index plane.
-- Target: engineering.parcel_footprints
-- H3 is a derived spatial index only; it carries no regulatory authority.
-- The migration intentionally fails closed if h3-pg is unavailable.

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS h3;
CREATE EXTENSION IF NOT EXISTS h3_postgis;

ALTER TABLE engineering.parcel_footprints
  ADD COLUMN IF NOT EXISTS h3_index_res8 TEXT;

ALTER TABLE engineering.parcel_footprints
  DROP CONSTRAINT IF EXISTS parcel_h3_index_res8_format;

ALTER TABLE engineering.parcel_footprints
  ADD CONSTRAINT parcel_h3_index_res8_format
  CHECK (h3_index_res8 IS NULL OR h3_index_res8 ~ '^[0-9a-f]{15}$');

CREATE INDEX IF NOT EXISTS parcel_footprints_h3_res8_idx
  ON engineering.parcel_footprints (h3_index_res8);

CREATE OR REPLACE FUNCTION engineering.refresh_parcel_h3_res8()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.geom_parcel IS NULL OR ST_IsEmpty(NEW.geom_parcel) THEN
    NEW.h3_index_res8 := NULL;
    RETURN NEW;
  END IF;

  NEW.h3_index_res8 := h3_latlng_to_cell(
    ST_Centroid(ST_Transform(NEW.geom_parcel, 4326)),
    8
  )::text;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_parcel_h3_res8
  ON engineering.parcel_footprints;

CREATE TRIGGER trg_refresh_parcel_h3_res8
BEFORE INSERT OR UPDATE OF geom_parcel
ON engineering.parcel_footprints
FOR EACH ROW
EXECUTE FUNCTION engineering.refresh_parcel_h3_res8();

UPDATE engineering.parcel_footprints
SET h3_index_res8 = h3_latlng_to_cell(
  ST_Centroid(ST_Transform(geom_parcel, 4326)),
  8
)::text
WHERE geom_parcel IS NOT NULL
  AND NOT ST_IsEmpty(geom_parcel);

CREATE OR REPLACE FUNCTION engineering.get_parcel_footprints_by_h3_res8(target_h3 TEXT)
RETURNS TABLE (
  footprint_id UUID,
  engineering_reference_token TEXT,
  zone_id UUID,
  geometry_geojson TEXT
)
LANGUAGE plpgsql
STABLE
STRICT
AS $$
BEGIN
  IF target_h3 IS NULL OR target_h3 !~ '^[0-9a-f]{15}$' THEN
    RAISE EXCEPTION 'Invalid H3 resolution-8 index';
  END IF;

  RETURN QUERY
  SELECT
    p.footprint_id,
    p.engineering_reference_token,
    p.zone_id,
    ST_AsGeoJSON(ST_Transform(p.geom_parcel, 4326))
  FROM engineering.parcel_footprints AS p
  WHERE p.h3_index_res8 = target_h3
    AND p.review_status = 'VERIFIED';
END;
$$;

COMMENT ON COLUMN engineering.parcel_footprints.h3_index_res8 IS
  'Derived H3 resolution-8 centroid index for spatial lookup only; never a regulatory or survey determination.';

COMMENT ON FUNCTION engineering.get_parcel_footprints_by_h3_res8(TEXT) IS
  'Returns verified privacy-reduced engineering parcel footprints sharing a derived H3 resolution-8 centroid cell.';

COMMIT;
