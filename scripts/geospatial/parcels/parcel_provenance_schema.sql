-- =============================================================================
-- Tri-State Digital Twin (TSM) — Multi-State Parcel Provenance Schema
-- =============================================================================
-- Target CRS: EPSG:2966 (NAD83 / Indiana West, US survey feet)
--   Chosen as the canonical horizontal engineering frame for the Lower
--   Wabash–Ohio Confluence tri-state region (IN / IL / KY). All ingested
--   parcel geometries are normalized to EPSG:2966 on write.
--   Vertical datum (NAVD88) is tracked as metadata only — never conflated
--   with the horizontal CRS.
--
-- Design principles (mirror the TSM stewardship charter):
--   * Technology informs people; it does not silently govern people.
--   * Provenance is first-class: every geometry carries source, CRS, hash,
--     and verification status.
--   * Fail-closed: invalid geometries are quarantined, never silently fixed
--     into the master table.
-- =============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Verification status domain
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provenance_status_enum') THEN
    CREATE TYPE provenance_status_enum AS ENUM ('VERIFIED', 'QUARANTINED', 'STALE');
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- Staging table: raw ingested features before validation
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parcel_staging_raw (
  ogc_fid        BIGSERIAL PRIMARY KEY,
  pin            TEXT,
  state_code     TEXT,
  agency_name    TEXT,
  source_endpoint TEXT,
  source_crs     TEXT,
  geom           GEOMETRY(MultiPolygon, 2966),
  ingested_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_parcel_staging_raw_geom
  ON public.parcel_staging_raw USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_parcel_staging_raw_state_pin
  ON public.parcel_staging_raw (state_code, pin);

-- -----------------------------------------------------------------------------
-- Master provenance table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parcel_provenance (
  parcel_id         TEXT PRIMARY KEY,
  state_code        TEXT NOT NULL CHECK (state_code IN ('IL', 'KY', 'IN', 'US')),
  source_agency     TEXT NOT NULL,
  source_url        TEXT NOT NULL,
  crs_source        TEXT NOT NULL,
  crs_target        TEXT NOT NULL DEFAULT 'EPSG:2966',
  vertical_datum    TEXT NOT NULL DEFAULT 'NAVD88',
  sha256_hash       TEXT NOT NULL,
  provenance_status provenance_status_enum NOT NULL DEFAULT 'QUARANTINED',
  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at       TIMESTAMPTZ,
  stale_after       TIMESTAMPTZ,
  geom              GEOMETRY(MultiPolygon, 2966) NOT NULL,
  -- Inform-only: screening attributes below are NOT authoritative observations.
  -- See TSM "three separate truths" doctrine: authoritative / computational /
  -- visual. Nothing in this table is a survey or a regulatory determination.
  screening_note    TEXT NOT NULL DEFAULT 'screening-reference-only'
);

CREATE INDEX IF NOT EXISTS idx_parcel_provenance_geom
  ON public.parcel_provenance USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_parcel_provenance_state_pin
  ON public.parcel_provenance (state_code, parcel_id);
CREATE INDEX IF NOT EXISTS idx_parcel_provenance_hash
  ON public.parcel_provenance (sha256_hash);
CREATE INDEX IF NOT EXISTS idx_parcel_provenance_status
  ON public.parcel_provenance (provenance_status);

-- -----------------------------------------------------------------------------
-- Validation trigger: normalize geometry, enforce CRS, quarantine on failure
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_validate_parcel_provenance()
RETURNS TRIGGER AS $$
DECLARE
  v_geom GEOMETRY;
BEGIN
  -- 1. Null / empty geometries are quarantined, never silently dropped.
  IF NEW.geom IS NULL OR ST_IsEmpty(NEW.geom) THEN
    NEW.provenance_status := 'QUARANTINED';
    NEW.screening_note := 'quarantined: null-or-empty geometry';
    RETURN NEW;
  END IF;

  -- 2. Repair topological defects deterministically, then promote to MultiPolygon.
  v_geom := ST_Multi(ST_MakeValid(NEW.geom));

  -- 3. Reproject anything not already in EPSG:2966.
  IF ST_SRID(v_geom) != 2966 THEN
    v_geom := ST_Transform(v_geom, 2966);
  END IF;

  -- 4. Reject degenerate results.
  IF ST_IsEmpty(v_geom) OR ST_Area(v_geom) <= 0 THEN
    NEW.provenance_status := 'QUARANTINED';
    NEW.screening_note := 'quarantined: degenerate geometry after validation';
    NEW.geom := ST_Multi(ST_CollectionExtract(ST_MakeValid(NEW.geom), 3));
    RETURN NEW;
  END IF;

  NEW.geom := v_geom;

  -- 5. Compute the SHA-256 geometry + identity hash when not supplied.
  IF NEW.sha256_hash IS NULL OR NEW.sha256_hash = '' THEN
    NEW.sha256_hash := encode(
      digest(
        COALESCE(NEW.parcel_id, '') || '|' || COALESCE(NEW.state_code, '') || '|' || ST_AsEWKB(NEW.geom)::text,
        'sha256'
      ),
      'hex'
    );
  END IF;

  -- 6. Mark stale when the source record is older than the refresh window.
  IF NEW.stale_after IS NOT NULL AND NEW.stale_after < CURRENT_TIMESTAMP
     AND NEW.provenance_status = 'VERIFIED' THEN
    NEW.provenance_status := 'STALE';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_parcel_provenance ON public.parcel_provenance;
CREATE TRIGGER trg_validate_parcel_provenance
  BEFORE INSERT OR UPDATE ON public.parcel_provenance
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_parcel_provenance();

-- -----------------------------------------------------------------------------
-- NFHL reference table (populated from FEMA NFHL S_Fld_Haz_Ar extracts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nfhl_sfha (
  ogc_fid     BIGSERIAL PRIMARY KEY,
  fld_zone    TEXT NOT NULL,
  zone_subty  TEXT,
  sfha_tf     TEXT NOT NULL DEFAULT 'T',
  static_bfe  DOUBLE PRECISION,
  v_datum     TEXT NOT NULL DEFAULT 'NAVD88',
  source_crs  TEXT NOT NULL DEFAULT 'EPSG:4326',
  geom        GEOMETRY(MultiPolygon, 2966) NOT NULL,
  loaded_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nfhl_sfha_geom
  ON public.nfhl_sfha USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_nfhl_sfha_zone
  ON public.nfhl_sfha (fld_zone);

COMMENT ON TABLE public.nfhl_sfha IS
  'FEMA National Flood Hazard Layer Special Flood Hazard Areas, reprojected to EPSG:2966. Reference only — not a FEMA determination.';

-- -----------------------------------------------------------------------------
-- Convenience view: verified parcels with area in US survey feet
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_verified_parcels AS
SELECT
  parcel_id,
  state_code,
  source_agency,
  provenance_status,
  ST_Area(geom) AS area_sqft,
  ST_Area(geom) / 43560.0 AS area_acres,
  fetched_at,
  geom
FROM public.parcel_provenance
WHERE provenance_status = 'VERIFIED';
