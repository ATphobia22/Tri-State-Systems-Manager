# Production Terrain and Self-Hosted 3D Tiles Deployment

## Public console routes

- **3D Terrain:** `/terrain-3d` — CesiumJS with the generated USGS 3DEP-derived OGC 3D Tiles 1.1 terrain tileset.
- **Twin Canvas:** `/twin` — MapLibre interactive twin.
- **Platform Capabilities:** `/platform` — UACF, geospatial, evidence, package and runtime index.

On GitHub Pages, route URLs are under `https://atphobia22.github.io/Tri-State-Systems-Manager/`.

## Build and publish chain

The `.github/workflows/deploy-pages.yml` workflow builds and validates the terrain data and self-hosted browser runtime. It generates the Terrain-RGB MBTiles input, runs `scripts/geospatial/build-terrain-3d-tiles.py`, validates the tileset with `scripts/geospatial/validate-terrain-3d-tiles.py`, vendors the pinned CesiumJS static distribution using `scripts/ci/install-cesium-static.mjs`, builds the Vite app, and validates generated `dist/3d-tiles` and `dist/vendor/cesium` outputs before uploading the Pages artifact. The workflow also runs browser rendering and post-publication integrity checks.

The build contract is guarded by `scripts/ci/validate-self-hosted-cesium.mjs`, which verifies the route, self-hosted runtime path, OGC 3D Tiles build/validation commands, published asset checks, and artifact provenance boundary.

## Terrain source and limits

The committed `tsm-console/public/terrain_3dep/` directory contains a Terrain-RGB derivative derived from the repository's USGS 3DEP pipeline. See `data-sources/manifests/usgs-3dep-terrain.json`, `artifacts/tsm-terrain-rgb-3dep-pipeline-v1.json`, and `artifacts/tsm-terrain-3d-tiles-v1.json` for source inventory, transformation, and evidence metadata.

This terrain is for visualization and screening. It is not survey-grade vertical control, not a verified NAVD88-to-ellipsoid transformation, and not a FEMA regulatory determination. The 3D mesh must retain its derived provenance and uncertainty boundaries.

## Visualization availability policy

The browser should render a valid, locally published visualization layer without depending on unrelated live gauges, an API credential, login, or a live provider call. A missing or corrupt tileset must create a visible renderer error, while the 2D map, flood simulator, and other independent views remain usable. This is **not** the same as treating an unverified source as authoritative: regulatory, engineering, and safety claims remain gated on their own validated evidence.

A source-code check is not proof that production Pages is up to date. Confirm the Actions workflow run and public assets independently after merging or dispatching a deployment.

## Local verification

From the repository root:

```bash
node scripts/ci/validate-self-hosted-cesium.mjs
npm --prefix tsm-console run check:cesium-terrain
npm --prefix tsm-console run check:type
npm --prefix tsm-console run check:3d-tiles-tools
```

For a full production deployment, use the repository's **TSM Production Build & Pages Deploy** workflow. Do not mark deployment verified until the public tileset, Cesium runtime, and browser rendering smoke test pass.
