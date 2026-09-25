-- =============================================================================
-- DESIGN-INTENT REFERENCE — DO NOT APPLY AS A MIGRATION
-- Source: owner technical package (Posey County notebook), 2026-09-25
-- Status: staged reference only.
--
-- This function assumes a `public.fema_nfhl_polygons` table that DOES NOT
-- EXIST in this repository. FEMA NFHL is currently ingested as runtime
-- GeoJSON via tsm-console/server/ingestion/fema-nfhl.mjs (ArcGIS MapServer),
-- not as a PostGIS table. Do not run this migration until a backing table
-- with the referenced columns (id, bfe_ft, zone_subty, evidence_sha256,
-- geom) is created and populated through the evidence pipeline.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_get_flood_mvt(z integer, x integer, y integer)
RETURNS bytea AS $$
DECLARE
    mvt bytea;
BEGIN
    WITH bbox AS (
        SELECT ST_TileEnvelope(z, x, y) AS env
    ),
    bounds AS (
        SELECT ST_Transform(env, 2966) AS env_2966 FROM bbox -- Indiana State Plane West (US Feet)
    ),
    mvtdata AS (
        SELECT
            id,
            bfe_ft,
            zone_subty,
            evidence_sha256,
            ST_AsMVTGeom(
                ST_Transform(geom, 3857),
                (SELECT env FROM bbox),
                4096,
                64,
                true
            ) AS geom
        FROM public.fema_nfhl_polygons, bbox
        WHERE ST_Intersects(geom, (SELECT env_2966 FROM bounds))
    )
    SELECT ST_AsMVT(mvtdata, 'flood_zones', 4096, 'geom') INTO mvt FROM mvtdata;

    RETURN mvt;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;
