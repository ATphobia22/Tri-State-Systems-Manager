-- TSM V035: auditable geometry reconciliation primitives.
-- IMPORTANT: This migration does not infer authoritative boundaries, delete slivers,
-- or assign a confidence score. Inputs must already be source-registered and CRS-tagged.
-- EPSG:2967 is a horizontal projected CRS; it does not establish a vertical datum.
BEGIN;

CREATE TABLE IF NOT EXISTS public.tsm_reconciled_aoi (
    aoi_id varchar(64) PRIMARY KEY,
    huc8_code varchar(8) NOT NULL CHECK (huc8_code ~ '^[0-9]{8}$'),
    jurisdictions_json jsonb NOT NULL CHECK (jsonb_typeof(jurisdictions_json) = 'array'),
    source_manifest_sha256 char(64) NOT NULL CHECK (source_manifest_sha256 ~ '^[0-9a-f]{64}$'),
    horizontal_srid integer NOT NULL,
    vertical_datum text,
    geometry_status text NOT NULL CHECK (geometry_status IN ('CANDIDATE','REVIEW_REQUIRED','VERIFIED')),
    created_at_utc timestamptz NOT NULL DEFAULT now(),
    geom geometry(MultiPolygon, 2967) NOT NULL,
    CHECK (ST_SRID(geom) = 2967),
    CHECK (ST_IsValid(geom)),
    CHECK (NOT ST_IsEmpty(geom))
);

CREATE INDEX IF NOT EXISTS tsm_reconciled_aoi_geom_gix
    ON public.tsm_reconciled_aoi USING gist (geom);

-- Review-only function: transform and intersect with a registered HUC mask.
-- It intentionally does not buffer/snap/delete small fragments or claim verification.
CREATE OR REPLACE FUNCTION public.fn_reconcile_tri_state_aoi(
    p_aoi_id varchar(64),
    p_raw_input_geom geometry,
    p_input_srid integer,
    p_target_huc8 varchar(8),
    p_source_manifest_sha256 char(64),
    p_jurisdictions jsonb,
    p_vertical_datum text DEFAULT NULL
)
RETURNS TABLE(status_code varchar(32), message text)
LANGUAGE plpgsql
AS $$
DECLARE
    v_input geometry;
    v_mask geometry;
    v_result geometry;
BEGIN
    IF p_aoi_id IS NULL OR length(trim(p_aoi_id)) = 0
       OR p_raw_input_geom IS NULL OR ST_IsEmpty(p_raw_input_geom)
       OR p_input_srid <= 0
       OR p_target_huc8 !~ '^[0-9]{8}$'
       OR p_source_manifest_sha256 !~ '^[0-9a-f]{64}$'
       OR p_jurisdictions IS NULL OR jsonb_typeof(p_jurisdictions) <> 'array' THEN
        RETURN QUERY SELECT 'BLOCKED_INVALID_INPUT'::varchar(32),
          'Required geometry provenance or input validation failed.'::text;
        RETURN;
    END IF;

    IF NOT ST_IsValid(p_raw_input_geom) THEN
        RETURN QUERY SELECT 'BLOCKED_INVALID_GEOMETRY'::varchar(32),
          'Input geometry is invalid; preserve source and repair only through a documented review.'::text;
        RETURN;
    END IF;

    SELECT geom INTO v_mask
      FROM public.nhd_huc8_boundaries
     WHERE huc8 = p_target_huc8
     LIMIT 1;

    IF v_mask IS NULL OR ST_IsEmpty(v_mask) THEN
        RETURN QUERY SELECT 'BLOCKED_INVALID_CONTEXT'::varchar(32),
          'HUC-8 mask is missing; no geometry was written.'::text;
        RETURN;
    END IF;

    IF ST_SRID(v_mask) = 0 THEN
        RETURN QUERY SELECT 'BLOCKED_UNKNOWN_CRS'::varchar(32),
          'HUC mask has no declared SRID; no geometry was written.'::text;
        RETURN;
    END IF;

    v_input := ST_Transform(ST_SetSRID(p_raw_input_geom, p_input_srid), 2967);
    v_mask := ST_Transform(v_mask, 2967);
    v_result := ST_CollectionExtract(ST_MakeValid(ST_Intersection(v_input, v_mask)), 3);
    v_result := ST_Multi(v_result);

    IF v_result IS NULL OR ST_IsEmpty(v_result) OR NOT ST_IsValid(v_result) THEN
        RETURN QUERY SELECT 'BLOCKED_NO_VALID_DOMAIN'::varchar(32),
          'Intersection produced no valid polygonal domain; no geometry was written.'::text;
        RETURN;
    END IF;

    INSERT INTO public.tsm_reconciled_aoi
      (aoi_id, huc8_code, jurisdictions_json, source_manifest_sha256,
       horizontal_srid, vertical_datum, geometry_status, geom)
    VALUES
      (p_aoi_id, p_target_huc8, p_jurisdictions, p_source_manifest_sha256,
       2967, p_vertical_datum, 'REVIEW_REQUIRED', v_result)
    ON CONFLICT (aoi_id) DO UPDATE SET
      huc8_code = EXCLUDED.huc8_code,
      jurisdictions_json = EXCLUDED.jurisdictions_json,
      source_manifest_sha256 = EXCLUDED.source_manifest_sha256,
      horizontal_srid = EXCLUDED.horizontal_srid,
      vertical_datum = EXCLUDED.vertical_datum,
      geometry_status = 'REVIEW_REQUIRED',
      created_at_utc = now(),
      geom = EXCLUDED.geom;

    RETURN QUERY SELECT 'REVIEW_REQUIRED'::varchar(32),
      'Candidate intersection stored with provenance; no snapping, sliver deletion, or engineering verification was performed.'::text;
END;
$$;

COMMIT;
