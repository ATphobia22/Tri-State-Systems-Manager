-- Reversal for 20261001_h3_spatial_indices.sql.
-- Execute only as part of an authorized database rollback.

BEGIN;

DROP FUNCTION IF EXISTS engineering.get_parcel_footprints_by_h3_res8(TEXT);
DROP TRIGGER IF EXISTS trg_refresh_parcel_h3_res8 ON engineering.parcel_footprints;
DROP FUNCTION IF EXISTS engineering.refresh_parcel_h3_res8();
DROP INDEX IF EXISTS engineering.parcel_footprints_h3_res8_idx;

ALTER TABLE engineering.parcel_footprints
  DROP CONSTRAINT IF EXISTS parcel_h3_index_res8_format;

ALTER TABLE engineering.parcel_footprints
  DROP COLUMN IF EXISTS h3_index_res8;

COMMIT;
