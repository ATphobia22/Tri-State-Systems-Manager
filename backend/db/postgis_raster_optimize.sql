-- PTDT v35 - Optimized PostGIS GiST + Raster Tiling
-- Target: 128x128 tiles, FILLFACTOR 70, REINDEX CONCURRENTLY after bulk loads
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_raster;

-- GiST spatial index with reduced fillfactor for update-heavy DEM workloads
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ptdt_spatial_nodes_geom
  ON public.ptdt_spatial_nodes
  USING GIST (geom_center)
  WITH (FILLFACTOR = 70);

-- Primary tile size for ST_Value random access (128x128)
-- Load example:
-- raster2pgsql -s 2966 -t 128x128 -I -C -M -Y dem.tif public.ptdt_dem_raster | psql ...

-- Performance pattern: filter first, then extract
-- SELECT ST_Value(rast, ST_Transform(ST_SetSRID(ST_MakePoint(-88.0142, 37.8348), 4326), 2966))
--   FROM public.ptdt_dem_raster
--  WHERE ST_Intersects(rast, ST_Transform(ST_SetSRID(ST_MakePoint(-88.0142, 37.8348), 4326), 2966));

-- Mandatory post-bulk maintenance (run after every DEM / ledger load)
REINDEX TABLE CONCURRENTLY public.ptdt_spatial_nodes;
REINDEX TABLE CONCURRENTLY public.ptdt_dem_raster;
ANALYZE public.ptdt_spatial_nodes, public.ptdt_dem_raster;
VACUUM (ANALYZE) public.ptdt_dem_raster;
