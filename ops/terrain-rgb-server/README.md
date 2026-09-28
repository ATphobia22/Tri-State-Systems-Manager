# TSM Terrain-RGB Tile Server

Lightweight Express server for **256×256 Mapbox Terrain-RGB** PNG tiles used by MapLibre `raster-dem` / `setTerrain()`.

## When to use this vs Martin

| Path | Use case |
|------|----------|
| **This Express server** | Simple XYZ `{z}/{x}/{y}.png` tree from `gdal2tiles` / extracted MBTiles |
| **Martin (`ops/martin`)** | MBTiles/PMTiles archives, PostGIS MVT parcels, production-scale delivery |

Martin (MapLibre) can also serve `tsm-terrain-rgb.mbtiles` from `build-terrain-rgb.sh` — preferred when you keep the rio-rgbify MBTiles product. This Express app is for plain XYZ directories.

> Note: GitHub `ATphobia22/martin` is referenced as the deployment contract in `ops/martin/README.md`. Upstream engine is [maplibre/martin](https://github.com/maplibre/martin). Configure MBTiles under `ops/martin/config.yaml` → `mbtiles.paths`.

## Layout

```text
tiles/
  {z}/
    {x}/
      {y}.png
```

## Local run

```bash
cd ops/terrain-rgb-server
npm install
TILE_DIR=../../dist/terrain-tiles/xyz npm start
```

Docker:

```bash
TSM_TERRAIN_XYZ_HOST_PATH=$PWD/../../dist/terrain-tiles/xyz \
  docker compose -f ops/terrain-rgb-server/docker-compose.yml up --build
```

## MapLibre / TSM env

**Development** (`import.meta.env.DEV` allows http/localhost in `terrain-rgb-contract`):

```bash
VITE_TSM_TERRAIN_RGB_URL_TEMPLATE=http://localhost:8080/terrain/{z}/{x}/{y}.png
```

**Production** (HTTPS required; no example.com / YOUR-HOST placeholders):

```bash
VITE_TSM_TERRAIN_RGB_URL_TEMPLATE=https://tiles.your-org.example/terrain/{z}/{x}/{y}.png
```

Until a valid template is set, the console **FAIL-CLOSED** (no synthetic mesh).

## Behavior

- `GET /terrain/:z/:x/:y.png` — PNG or **204** if missing
- `GET /health` — liveness JSON
- Path traversal blocked
- Long-cache headers on successful tiles
