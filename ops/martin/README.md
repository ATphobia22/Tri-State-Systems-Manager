# Martin Open-World Tile Plane

This directory defines the TSM deployment contract for the `ATphobia22/martin` tile-server repository.

## Role

Martin is the high-throughput delivery layer for approved TSM geospatial derivatives. Current upstream Martin supports PostGIS, PMTiles, MBTiles, GeoJSON, and other tile sources; TSM uses it for dynamic vector data and pre-generated tile archives while keeping authoritative government services outside the repository.

## Runtime inputs

- `TSM_MARTIN_DATABASE_URL`: TLS-capable PostGIS connection string supplied by the deployment secret manager.
- `/data/pmtiles`: mounted approved PMTiles archives.
- `/data/styles`: MapLibre style JSON resources.

## Security

- Never commit database URLs containing credentials.
- Use TLS for remote object storage and PostgreSQL.
- Do not enable invalid TLS certificate acceptance in production.
- Do not expose the database directly to the public internet.
- Apply an authenticated reverse proxy/rate limit in front of production Martin when the deployment is not otherwise isolated.

## Data boundaries

Martin does not determine FEMA regulatory status, floodway compliance, BFE validity, HEC-RAS correctness, or engineering certification. It serves visualization-oriented geospatial products whose provenance is tracked by TSM.

## 3D Tiles

OGC 3D Tiles are a separate renderable-content contract. Martin may serve supporting 2D/vector/coverage data, while the open-world client consumes an explicitly registered 3D Tiles tileset for photogrammetry, buildings, point clouds, or other massive 3D content.

## Local validation

Use the Martin configuration schema from the pinned/selected Martin release before deployment. The repository's CI should validate the YAML structure and TSM's manifest contracts before publishing a runtime image.


## Cadastral MVT contract

`ops/martin/sql/get_parcel_tiles.sql` defines the explicit Martin PostgreSQL Function Source:

- Function: `public.get_parcel_tiles(integer, integer, integer)`.
- Geometry storage contract: EPSG:2966.
- Tile geometry: EPSG:3857 / MVT extent 4096 / buffer 64.
- Feature elevation property: `ground_elevation_navd88_ft` (feet NAVD88).
- Provenance property: `evidence_sha256`.
- Martin API route under this configuration: `/get_parcel_tiles/{z}/{x}/{y}`.
- `base_path: /tiles` affects TileJSON URL generation; it is not an API route prefix. Set Martin `route_prefix` and `VITE_TSM_MARTIN_ROUTE_PREFIX` together if the API is intentionally mounted below a path.

The browser renderer converts the elevation values from feet NAVD88 to meters before using MapLibre `fill-extrusion-base` and `fill-extrusion-height`. Raw gage height is never used as a NAVD88 water-surface elevation.
