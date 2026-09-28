# Production Terrain-RGB deployment (GitHub Pages + HTTPS tiles)

GitHub Pages serves the SPA at `https://atphobia22.github.io/Tri-State-Systems-Manager/`.
MapLibre **3D terrain** only enables when:

1. Terrain-RGB tiles are published under **HTTPS**
2. `VITE_TSM_TERRAIN_RGB_URL_TEMPLATE` is a **real** HTTPS XYZ template with `{z}/{x}/{y}` (baked into the Pages workflow env at build time — see below)
3. Production Vite build injects that variable

Until then the client correctly stays **FAIL-CLOSED** (flat imagery + hillshade + flood overlays).

## Verified 2026-09-27 (this VM)

- **mbtiles integrity** — `dist/terrain-tiles/terrain-3dep.mbtiles`: 28 rows
  (z11×2, z12×2, z13×2, z14×6, z15×16), metadata `name=terrain_3dep`,
  `format=png`. All 28 tiles decoded (1,835,008 pixels); elevation range
  **337.93–372.38 ft**, inside the documented 337.7–372.5 ft screening range.
  SHA-256 `83f94cf7…baf0` matches `artifacts/tsm-terrain-rgb-3dep-pipeline-v1.json` exactly.
- **Pages pyramid** — `tsm-console/public/terrain_3dep/`: 28/28 PNGs decode,
  256×256, same elevation range. `tiles.json` is valid TileJSON 3.0.0 and
  already points at the production template
  `https://atphobia22.github.io/Tri-State-Systems-Manager/terrain_3dep/{z}/{x}/{y}.png`.
- **HTTPS serving** — `ops/terrain-tiles/server.mjs` (Express + TLS) verified
  end-to-end: tile request → HTTP 200, `Content-Type: image/png`, PNG magic
  bytes, served bytes byte-identical to the pyramid on disk; missing tile →
  404; malformed coordinates → 400; `/healthz` → 200. Tested with a 1-day
  self-signed cert (discarded afterwards).
- **Pages wiring** — `.github/workflows/deploy-pages.yml` now sets
  `VITE_TSM_TERRAIN_RGB_URL_TEMPLATE=https://atphobia22.github.io/Tri-State-Systems-Manager/terrain_3dep/{z}/{x}/{y}.png`
  in the build job `env`, with CI validation (must be `https://` and contain
  `{z}/{x}/{y}`). The next Pages deploy ships real 3D terrain; no repository
  variable needed for the Pages path.

## What cannot be invented in CI/sandbox

- A public tile domain and TLS certificate for your own host
- A truthful `MATERIALIZED` evidence status with a fabricated SHA-256
- Live 3DEP bulk processing without GDAL + `rio-rgbify` on a workstation

## Operator checklist

### Done (no action needed)

- [x] Screening tile pyramid built (28 tiles, z11–z15) and committed for Pages
- [x] mbtiles built and hash-verified against the evidence artifact
- [x] Express + TLS tile server verified locally
- [x] Pages workflow injects the real terrain template at build time

### 1. Rebuild Pages (owner)

Actions → **TSM Production Build & Pages Deploy** → Run workflow.
Confirm 3D terrain enables on the published site (flat = fail-closed, check
the template made it into the build).

### 2. Full-production tiles (workstation, optional upgrade)

The committed pyramid is screening-level (28 tiles, z11–z15, bundled DEM).
For a full-production pyramid from live 3DEP on a workstation with GDAL:

```bash
chmod +x ./scripts/geospatial/build-terrain-rgb.sh
./scripts/geospatial/build-terrain-rgb.sh
```

Outputs (gitignored): `dist/terrain-tiles/` and evidence manifest with **real** source hashes.

### 3. Public tile host (VPS + DNS — owner only, optional)

Only needed if you want tiles off Pages on your own domain (Martin + Caddy).
This VM has no Docker; all of this runs on your host:

```bash
export TILE_DOMAIN=tiles.your-real-domain.tld
export TSM_MBTILES_HOST_PATH=$PWD/dist/terrain-tiles   # copy terrain-3dep.mbtiles here first
docker compose -f ops/martin/docker-compose.tls.yml up -d
curl -sS "https://${TILE_DOMAIN}/catalog"
```

Prerequisites you must do in your DNS/hosting provider:

1. Provision a VPS (any host with Docker) and point an **A record** for
   `tiles.your-real-domain.tld` at its public IP.
2. Copy `dist/terrain-tiles/terrain-3dep.mbtiles` to the host.
3. Caddy terminates TLS automatically via Let's Encrypt (port 443 must be reachable).
4. If you switch the template to your domain, update
   `VITE_TSM_TERRAIN_RGB_URL_TEMPLATE` in `.github/workflows/deploy-pages.yml`
   (or set the `VITE_TSM_TERRAIN_RGB_URL_TEMPLATE` repository variable and
   reference it as `${{ vars.VITE_TSM_TERRAIN_RGB_URL_TEMPLATE }}`) and
   redeploy Pages. Never use `example.com`, `YOUR-HOST`, or `localhost` —
   the fail-closed validator will keep terrain flat.

### 4. Evidence

Mark `runtime.status: MATERIALIZED` only after real DEM hashes and live HTTPS tiles exist.
