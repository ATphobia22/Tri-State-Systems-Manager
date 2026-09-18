-- TSM dynamic cadastral MVT source for Martin.
-- Geometry storage is expected to be EPSG:2966 (Indiana East State Plane).
-- Elevation attributes are explicitly in feet NAVD88; the browser converts them
-- to meters only at the MapLibre rendering boundary.

CREATE OR REPLACE FUNCTION public.get_parcel_tiles(
    z integer,
    x integer,
    y integer
)
RETURNS bytea
LANGUAGE plpgsql
STABLE
STRICT
PARALLEL SAFE
AS $$
DECLARE
    tile_bounds_3857 geometry;
    tile_bounds_2966 geometry;
    mvt bytea;
BEGIN
    IF z < 0 OR z > 30 OR x < 0 OR y < 0 THEN
        RAISE EXCEPTION 'Invalid XYZ tile coordinates: z=%, x=%, y=%', z, x, y;
    END IF;

    tile_bounds_3857 := ST_TileEnvelope(z, x, y);
    tile_bounds_2966 := ST_Transform(tile_bounds_3857, 2966);

    SELECT ST_AsMVT(tile_rows, 'parcels', 4096, 'mvt_geom')
      INTO mvt
      FROM (
        SELECT
            p.parcel_id,
            p.apn,
            p.owner_name,
            p.acreage,
            p.site_address,
            p.ground_elevation_navd88 AS ground_elevation_navd88_ft,
            p.evidence_sha256,
            ST_AsMVTGeom(
                ST_Transform(p.geom, 3857),
                tile_bounds_3857,
                4096,
                64,
                true
            ) AS mvt_geom
        FROM cadastral.parcels AS p
        WHERE p.geom && tile_bounds_2966
          AND ST_Intersects(p.geom, tile_bounds_2966)
      ) AS tile_rows
     WHERE mvt_geom IS NOT NULL;

    RETURN COALESCE(mvt, ''::bytea);
END;
$$;

COMMENT ON FUNCTION public.get_parcel_tiles(integer, integer, integer)
IS '{
  "description": "TSM cadastral parcel MVT source. Geometry is EPSG:2966; elevation properties are feet NAVD88; evidence_sha256 identifies the provenance ledger record.",
  "attribution": "Tri-State Systems Manager cadastral visualization fabric",
  "minzoom": 12,
  "maxzoom": 20,
  "vector_layers": [
    {
      "id": "parcels",
      "fields": {
        "parcel_id": "String",
        "apn": "String",
        "owner_name": "String",
        "acreage": "Number",
        "site_address": "String",
        "ground_elevation_navd88_ft": "Number",
        "evidence_sha256": "String"
      }
    }
  ]
}';
