# Martin local setup (TSM)

**Do not** put database passwords in committed YAML. Use `TSM_MARTIN_DATABASE_URL`.

Canonical config: `ops/martin/config.yaml`

## Install (Linux x86_64 example)

```bash
sudo apt-get update && sudo apt-get install -y gdal-bin postgresql-client curl

curl -sLO https://github.com/maplibre/martin/releases/latest/download/martin-x86_64-unknown-linux-musl.tar.gz
tar -xf martin-x86_64-unknown-linux-musl.tar.gz
sudo mv martin /usr/local/bin/
martin --version
```

## Environment

```bash
export TSM_MARTIN_DATABASE_URL='postgres://USER:PASSWORD@127.0.0.1:5432/tsm_geospatial'
```

## Run

```bash
martin --config ops/martin/config.yaml
```

## SQL

- Parcels: `ops/martin/sql/get_parcel_tiles.sql` (wired in config)
- Flood MVT template: `ops/martin/sql/rpc_get_flood_mvt.sql` (add to config only after table exists)

## Frontend

See `tsm-console/src/lib/martin-tile-fabric.ts` and vars `VITE_TSM_MARTIN_BASE_URL`.
