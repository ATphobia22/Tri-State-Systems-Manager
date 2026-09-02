# TSM Console (Tri-State Systems Manager)

## Run

```bash
# Install from the lockfile
npm ci

# SPA development
npm run dev

# Backend policy/evidence service
npm run proxy
# or both:
npm run dev:all

# Production build
npm run build
npm run preview
```

## Environment

Copy `.env.example` → `.env` and configure only the public OIDC client settings required by the browser:

```text
VITE_IDP_PROVIDER=oidc
VITE_IDP_AUTHORITY=https://<your-identity-provider>
VITE_IDP_CLIENT_ID=<public-client-id>
VITE_IDP_REDIRECT_URI=http://localhost:5173/login/callback
```

The browser uses Authorization Code + PKCE. Do **not** place an OIDC client secret or token endpoint credential in the SPA environment. The backend token-proxy process does not require a client secret.

## Architecture highlights

- React Router v7 loaders + Zero-Trust auth gate
- Persistent Merkle Evidence Ledger
- Live NOAA/USGS stage
- 3D Digital Twin canvas (`/twin`) driven by source-derived terrain
- Twin Solar Flood Tiles + A*/JPS/Theta*/D* Lite pathfinding boundary
- Backend evidence/policy service
- OpenMI 2.0 descriptor contracts + evidentiary provenance notes

Human authority remains final.

## Posey 2020 Geospatial Asset Chain

The Bonebank digital-twin viewport consumes a bounded, provenance-first geospatial source chain:

| Asset | Source | Acquisition | CRS / vertical datum | Role |
|---|---|---:|---|---|
| Bare-earth terrain | Indiana 2016–2020 DEM ImageServer | 2020 Posey collection | EPSG:2966 / NAVD88 | `OBSERVATION / RAW` |
| Reference LiDAR | Purdue Digital Forestry `IN2020_26800940_12.las` | 2020 | EPSG:2966-compatible / NAVD88 | provenance/reference; not committed |
| Orthophoto | USDA NAIP 2020 Indiana ImageServer | 2020 | requested in EPSG:2966 | `OBSERVATION / RAW` |

Registered AOI: `2680000,940000,2685000,945000` in EPSG:2966.

Large source binaries are intentionally excluded from Git. The reproducible downloader materializes them under `data/geospatial/cache/posey-2020/`, computes SHA-256 hashes, and writes an asset-download manifest.

```bash
npm run geospatial:fetch
npm run geospatial:validate
npm run ci:full
```

Runtime browser consumption uses the bounded backend endpoints:

- `GET /api/geospatial/posey/site`
- `GET /api/geospatial/posey/raster?kind=terrain&bbox=...`
- `GET /api/geospatial/posey/raster?kind=orthophoto&bbox=...`

The backend allowlists the upstream source hosts and rejects AOIs outside the registered site footprint. Terrain is decoded into a NAVD88 elevation grid; the same source-derived grid feeds the Three.js terrain mesh, Twin Solar Flood Tiles, and terrain-derived pathfinding walkability. The orthophoto is mapped to the same AOI and tagged as sRGB color data for Three.js rendering.

BFE/LAG/FFE remain separate configured project parameters. They are not inferred from the rendered raster, and the frontend does not itself create an evidentiary seal.
