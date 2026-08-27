-- PTDT v35 - PostGIS GiST + Raster (init-safe for docker-entrypoint-initdb.d)
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
--       Init scripts run in a transaction — use non-concurrent forms here.
--       Run REINDEX CONCURRENTLY manually after bulk loads in production.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_raster;

-- Stub tables so index creation succeeds on fresh DB
CREATE TABLE IF NOT EXISTS public.ptdt_spatial_nodes (
    node_id          bigserial PRIMARY KEY,
    geom_center      geometry(Point, 2966),
    parcel_apn       text,
    bfe_ft_navd88    double precision DEFAULT 375.0,
    lag_ft_navd88    double precision DEFAULT 377.2,
    created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ptdt_dem_raster (
    rid    serial PRIMARY KEY,
    rast   raster
);

-- Non-concurrent GiST (init-safe). Prefer FILLFACTOR 70 for update-heavy DEM.
CREATE INDEX IF NOT EXISTS idx_ptdt_spatial_nodes_geom
  ON public.ptdt_spatial_nodes
  USING GIST (geom_center)
  WITH (FILLFACTOR = 70);

-- Optional: constrain CRS on geometry column when PostGIS supports it
-- ALTER TABLE public.ptdt_spatial_nodes
--   ADD CONSTRAINT enforce_srid_2966 CHECK (ST_SRID(geom_center) = 2966);

ANALYZE public.ptdt_spatial_nodes;

-- ---------------------------------------------------------------------------
-- Production maintenance (run OUTSIDE init, after bulk DEM/ledger loads):
--   REINDEX TABLE CONCURRENTLY public.ptdt_spatial_nodes;
--   REINDEX TABLE CONCURRENTLY public.ptdt_dem_raster;
--   ANALYZE public.ptdt_spatial_nodes, public.ptdt_dem_raster;
--   VACUUM (ANALYZE) public.ptdt_dem_raster;
-- ---------------------------------------------------------------------------
