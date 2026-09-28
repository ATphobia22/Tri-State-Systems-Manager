# Martin Open-World Tile Plane

TSM’s high-throughput tile delivery layer uses the **official MapLibre Martin** image, not a private `ATphobia22/martin` fork.

| Item | Value |
|------|--------|
| Upstream | https://github.com/maplibre/martin |
| Image (compose pin) | `ghcr.io/maplibre/martin:v0.16.0` |
| Config | `ops/martin/config.yaml` |
| Compose | `ops/martin/docker-compose.yml` |

## Role

Martin serves approved geospatial derivatives:

- **PostGIS MVT** — `get_parcel_tiles` (cadastral / elevation attributes)
- **PMTiles** — basemap and other archives under `/data/pmtiles`
- **MBTiles** — including **Terrain-RGB** from `scripts/geospatial/build-terrain-rgb.sh` under `/data/mbtiles`

Authoritative government services (FEMA NFHL, Indiana imagery, USGS live stage) remain external. Martin does not certify flood zones, surveys, or HEC-RAS results.

## Runtime inputs

| Input | Purpose |
|-------|---------|
| `TSM_MARTIN_DATABASE_URL` | TLS PostGIS URL (secret manager only) |
| `/data/pmtiles` | Approved PMTiles |
| `/data/mbtiles` | Terrain-RGB and other MBTiles (`*.mbtiles`) |
| `/data/styles` | Optional MapLibre styles |

## Terrain-RGB (3D mesh)

1. Build: `./scripts/geospatial/build-terrain-rgb.sh` → `dist/terrain-tiles/tsm-terrain-rgb.mbtiles` (or XYZ tree).
2. Mount MBTiles at `/data/mbtiles` **or** serve XYZ via `ops/terrain-rgb-server`.
3. After Martin starts, inspect `/catalog` for the MBTiles source name and tile URL template.
4. Set production env to a **real HTTPS** template:

```bash
VITE_TSM_TERRAIN_RGB_URL_TEMPLATE=https://tiles.your-org.example/.../{z}/{x}/{y}
```

Placeholder hosts (`example.com`, `YOUR-HOST`, bare `localhost` in production builds) remain **FAIL-CLOSED** in `tsm-console/src/lib/terrain-rgb-contract.ts`.

### Color decoding (Mapbox encoding)

```text
height_m = -10000 + (R * 256 * 256 + G * 256 + B) * 0.1
```

Tile size **256×256**, MapLibre `encoding: "mapbox"`. See `docs/TERRAIN-RGB-3DEP-PIPELINE.md`.

## Photorealistic twin

3D terrain is relief only. Real-time photorealism also uses:

- Indiana current orthophoto (live WMS)
- USGS 3DEP hillshade as visualization (not a DEM mesh substitute)
- Live hydrology + evidence-gated water extrusion
- Human authority for regulatory meaning

## TLS (production)

Terminate TLS at Caddy, Traefik, or a cloud load balancer in front of Martin. Do not publish Martin plain HTTP on the public internet without an authenticated edge.

## Security

- Never commit database URLs with credentials.
- Use TLS for PostgreSQL and remote object storage.
- Do not expose PostGIS directly.
- Prefer reverse-proxy rate limits on public tile endpoints.

## Cadastral MVT contract

`ops/martin/sql/get_parcel_tiles.sql` defines:

- Function: `public.get_parcel_tiles(z, x, y)`
- Storage CRS: EPSG:2966; MVT geometry EPSG:3857
- Properties: `ground_elevation_navd88_ft`, `evidence_sha256`
- Route: `/get_parcel_tiles/{z}/{x}/{y}` (subject to `base_path` / route_prefix)

## Local validation

```bash
docker compose -f ops/martin/docker-compose.yml config
docker compose -f ops/martin/docker-compose.yml up
curl -sS http://127.0.0.1:3000/catalog | head
```

Validate YAML against the Martin config schema for the pinned image tag before production promote.
