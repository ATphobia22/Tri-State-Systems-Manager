# Database bootstrap status (sandbox)

**Date:** 2026-09-25  
**Runtime:** PostgreSQL 16 + PostGIS 3 (native; Docker not available in this environment)

## Clusters / databases

| Database | Purpose | Status |
|----------|---------|--------|
| `tsm_evidence` | Evidence artifacts, FIRM, panel provenance, Merkle | **UP** — schemas applied |
| `tsm_geospatial` | Subsurface, cadastral MVT, flood MVT template | **UP** — schemas + functions |
| `ptdt_v35` | Engineering / subsurface twin | **UP** — V35 subsurface applied |

Local role (CI/dev only, **not for production**): use secret manager in production — never commit passwords.

## Applied SQL

- `tsm-console/server/store/schema.sql` → evidence store  
- `db/migrations/009_firm_assets.sql` → firm_panel / firm_derivative  
- Layer2 `tsm_panel_provenance.sql` → panel provenance  
- `db/migrations/V35__subsurface_layers.sql` → boreholes / strata  
- `ops/martin/sql/get_parcel_tiles.sql` → needs `cadastral.parcels` (**created**)  
- `ops/martin/sql/rpc_get_flood_mvt.sql` → needs `fema_nfhl_polygons` (**stub table**)

## Smoke results

- `get_parcel_tiles` / `rpc_get_flood_mvt` → empty MVT, **no error**  
- Simulation evidence row with `is_simulation_demo = true`  

## Fix applied

`get_parcel_tiles` referenced `cadastral.parcels` but schema was missing → created **`cadastral` schema + table**.

## Docker path (operator machine)

```bash
POSTGRES_USER=tsm POSTGRES_PASSWORD=*** POSTGRES_DB=ptdt_v35 docker compose up -d postgis_db
cd tsm-console && docker compose up -d
```
