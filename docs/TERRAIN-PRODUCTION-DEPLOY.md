# Production Terrain-RGB deployment (GitHub Pages + HTTPS tiles)

GitHub Pages serves the SPA at `https://atphobia22.github.io/Tri-State-Systems-Manager/`.
MapLibre **3D terrain** only enables when:

1. Terrain-RGB tiles are published under **HTTPS**
2. Repository variable `VITE_TSM_TERRAIN_RGB_URL_TEMPLATE` is a **real** HTTPS XYZ template with `{z}/{x}/{y}`
3. Production Vite build injects that variable

Until then the client correctly stays **FAIL-CLOSED** (flat imagery + hillshade + flood overlays).

## What cannot be invented in CI/sandbox

- A public tile domain and TLS certificate for your host
- A truthful `MATERIALIZED` evidence status with a fabricated SHA-256
- Live 3DEP bulk processing without GDAL + `rio-rgbify` on a workstation

## Operator checklist

### 1. Build tiles (workstation)

```bash
chmod +x ./scripts/geospatial/build-terrain-rgb.sh
./scripts/geospatial/build-terrain-rgb.sh
```

Outputs (gitignored): `dist/terrain-tiles/` and evidence manifest with **real** source hashes.

### 2. Publish under HTTPS (Martin + Caddy)

```bash
export TILE_DOMAIN=tiles.your-real-domain.tld
export TSM_MBTILES_HOST_PATH=$PWD/dist/terrain-tiles
docker compose -f ops/martin/docker-compose.tls.yml up -d
curl -sS "https://${TILE_DOMAIN}/catalog"
```

Use the catalog source id in the template:
`https://$TILE_DOMAIN/<source_id>/{z}/{x}/{y}`

### 3. GitHub Actions variables (owner UI)

| Name | Value |
|------|--------|
| `TSM_PAGES_ENABLED` | `true` |
| `VITE_TSM_TERRAIN_RGB_URL_TEMPLATE` | `https://tiles.your-real-domain.tld/<source>/{z}/{x}/{y}` |
| `VITE_TSM_TERRAIN_RGB_MAXZOOM` | optional (`14`) |

Do **not** use `example.com`, `YOUR-HOST`, or `localhost`.

Also ensure the production workflow `env` block includes:

```yaml
VITE_TSM_TERRAIN_RGB_URL_TEMPLATE: ${{ vars.VITE_TSM_TERRAIN_RGB_URL_TEMPLATE }}
VITE_TSM_TERRAIN_RGB_MAXZOOM: ${{ vars.VITE_TSM_TERRAIN_RGB_MAXZOOM }}
```

### 4. Rebuild Pages

Actions → **TSM Production Build & Pages Deploy** → Run workflow.

### 5. Evidence

Mark `runtime.status: MATERIALIZED` only after real DEM hashes and live HTTPS tiles exist.
