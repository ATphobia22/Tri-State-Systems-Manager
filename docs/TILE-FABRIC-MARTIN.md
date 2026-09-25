# Martin Tile Server — Optional Runbook

Status: **reference runbook** — an alternative tile-serving path. The
repository's current local tile path is the Node-based
`tsm-console/server/tiles/local-tile-server.mjs` (+ `local-tile-config.json`).
This document describes how to stand up [Martin](https://github.com/maplibre/martin)
(a Rust tile server) for dynamic PostGIS vector tiles (`.pbf`) and
cloud-native PMTiles basemaps, if the Node path becomes a bottleneck.

It does not replace the existing tile server. Adopt it only as a deliberate
infrastructure decision.

## 1. Install spatial utilities and the Martin binary

```bash
sudo apt-get update && sudo apt-get install -y \
    gdal-bin \
    pdal \
    postgresql-client \
    curl \
    git

curl -sLO https://github.com/maplibre/martin/releases/latest/download/martin-x86_64-unknown-linux-musl.tar.gz
tar -xvf martin-x86_64-unknown-linux-musl.tar.gz
sudo mv martin /usr/local/bin/
martin --version
```

## 2. Martin configuration

Save as `ops/postgis/martin-config.yaml` (do not commit secrets — the
connection string below is read from the environment):

```yaml
pg:
  connection_string: ${PG_CONNECTION_STRING}
  ssl_mode: prefer
  auto_bounds: calc

pmtiles:
  paths:
    - ./tiles/basemaps
    - ./tiles/flood_layers

keep_alive: 75
listen_addresses: "0.0.0.0:3000"
worker_processes: 4
```

Notes and corrections vs the original owner package (2026-09-25):

- The original draft hardcoded `postgres://tsm_user:tsm_password@localhost:5432/tsm_geospatial`
  in the config. **Never commit credentials.** Use `${PG_CONNECTION_STRING}`
  from the environment (same convention as the repo's Compose files).
- `ssl_mode: disable` was changed to `prefer`; re-enable strict TLS for any
  non-local database.
- Paths were rewritten relative to the repo (`ops/postgis/…`); the original
  draft used absolute `/home/workdir/…` paths from another machine.
- The companion PostGIS MVT function draft lives at
  `ops/postgis/mvt/rpc_get_flood_mvt.sql` — staged reference only, because
  its backing table does not exist yet (see the banner in that file).

## 3. Start the server

```bash
export PG_CONNECTION_STRING="postgres://tsm_user@localhost:5432/tsm_geospatial"
martin --config ops/postgis/martin-config.yaml
```

## 4. Wire-up

Point the web client's tile sources at `http://localhost:3000` (or the
deployed Martin host) for `flood_zones` MVT layers and PMTiles basemaps.
Keep the fail-closed rule: a tile backend that is unreachable must surface
tiles as unavailable, never as silently empty.
