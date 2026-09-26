-- Example MVT function for NFHL-style polygons (template).
-- Requires: PostGIS, table public.fema_nfhl_polygons(geom geometry, ...)
-- Do not embed DB passwords in Martin config — use TSM_MARTIN_DATABASE_URL.

CREATE OR REPLACE FUNCTION public.rpc_get_flood_mvt(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  mvt bytea;
BEGIN
  IF z IS NULL OR x IS NULL OR y IS NULL OR z < 0 OR z > 22 THEN
    RAISE EXCEPTION 'invalid tile coordinates';
  END IF;

  WITH bbox AS (
    SELECT ST_TileEnvelope(z, x, y) AS env
  ),
  mvtdata AS (
    SELECT
      p.id,
      p.bfe_ft,
      p.zone_subty,
      p.evidence_sha256,
      ST_AsMVTGeom(
        ST_Transform(p.geom, 3857),
        bbox.env,
        4096,
        64,
        true
      ) AS geom
    FROM public.fema_nfhl_polygons p
    CROSS JOIN bbox
    WHERE p.geom IS NOT NULL
      AND ST_Intersects(
        ST_Transform(p.geom, 3857),
        bbox.env
      )
  )
  SELECT ST_AsMVT(mvtdata, 'flood_zones', 4096, 'geom')
  INTO mvt
  FROM mvtdata;

  RETURN mvt;
END;
$$;

COMMENT ON FUNCTION public.rpc_get_flood_mvt(integer, integer, integer) IS
  'TSM template MVT for flood polygons. SIMULATION until table + CRS verified. Not a FEMA product.';
