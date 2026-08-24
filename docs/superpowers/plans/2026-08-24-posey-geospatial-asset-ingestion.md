# Posey Geospatial Terrain + Orthophoto Asset Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind the real Posey County 2020 QL2 terrain and 2020 NAIP orthophoto sources to the TSM digital twin through a provenance-first, reproducible geospatial ingestion path and feed terrain heights into Twin Solar Flood Tiles.

**Architecture:** Keep authoritative binaries outside Git. The backend downloads/streams the authoritative Indiana DEM ImageServer and USDA/USGS 2020 NAIP ImageServer assets, records exact source URI/AOI/CRS/datum/resolution/hash when materialized, and exposes a bounded site-tile API to the browser. The React/Three.js viewport consumes a normalized EPSG:2966/NAVD88 terrain grid and a georeferenced orthophoto texture; the existing solar/pathfinding engine receives the same terrain grid so visualization and simulation share one source-derived surface.

**Tech Stack:** TypeScript 5.6, React 19, Three.js 0.170, React Three Fiber 9, Node 20 `http`/`fetch`, `geotiff`, ArcGIS ImageServer REST, EPSG:2966, NAVD88, Vitest/Node test runner.

**Spec:** `docs/digital-twin/ORTHO-SOLAR-FLOOD-TILE-ENGINE.md` plus the approved 2026-08-24 geospatial integration design in conversation.

## Global Constraints

- Authoritative terrain source: Indiana 2016–2020 hydro-flattened bare-earth DEM derived from QL2 LiDAR; Posey acquisition year 2020.
- Source terrain CRS: EPSG:2966 / NAD83 Indiana West (ftUS); vertical datum: NAVD88.
- Reference LiDAR tile: `IN2020_26800940_12.las`; retain its Purdue/iDiF source URI in provenance but do not commit the ~305 MB binary.
- Orthophoto source: USDA NAIP 2020 Indiana, 4-band imagery; consume through the public 2020 NAIP ImageServer or equivalent source URL recorded in the manifest.
- Site AOI: EPSG:2966 bounds `2680000,940000,2685000,945000`, matching the supplied 5,000-ft reference tile footprint.
- No synthetic elevation values may be labeled authoritative. Existing BFE/LAG/FFE values remain separate project parameters.
- Derived rasters/grids must be labeled `DERIVED`; source imagery/elevation must be labeled `OBSERVATION`/`RAW` as appropriate.
- Large binaries remain outside Git and are fetched into a local cache by reproducible tooling.
- Browser UI is never the evidentiary authority; backend provenance and human review gates remain authoritative.

---

### Task 1: Register the authoritative Posey terrain and orthophoto assets

**Files:**
- Create: `tsm-console/src/geospatial/site-asset-manifest.ts`
- Create: `tsm-console/data/manifests/posey-2020-site-assets.json`
- Test: `tsm-console/tests/geospatial-asset-manifest.test.ts`

**Interfaces:**
- Produces `POSEY_2020_ASSETS`, `PoseyAssetManifest`, and `SiteBounds2966`.
- `POSEY_2020_ASSETS.terrain.sourceUri` must identify the Indiana DEM ImageServer; `.terrain.referenceLidarUri` must identify the exact Purdue `IN2020_26800940_12.las` file.
- `POSEY_2020_ASSETS.orthophoto.sourceUri` must identify the 2020 NAIP ImageServer.

- [ ] **Step 1: Write the failing manifest tests**

```ts
import { describe, expect, it } from 'vitest';
import { POSEY_2020_ASSETS } from '../src/geospatial/site-asset-manifest';

describe('Posey 2020 asset manifest', () => {
  it('pins the supplied tile footprint and authoritative CRS', () => {
    expect(POSEY_2020_ASSETS.bounds).toEqual({ minX: 2680000, minY: 940000, maxX: 2685000, maxY: 945000 });
    expect(POSEY_2020_ASSETS.horizontalCrs).toBe('EPSG:2966');
    expect(POSEY_2020_ASSETS.verticalDatum).toBe('NAVD88');
  });

  it('records source URIs without pretending a derived asset is authoritative', () => {
    expect(POSEY_2020_ASSETS.terrain.sourceUri).toContain('Indiana_2016_2020_DEM/ImageServer');
    expect(POSEY_2020_ASSETS.terrain.referenceLidarUri).toContain('IN2020_26800940_12.las');
    expect(POSEY_2020_ASSETS.orthophoto.sourceUri).toContain('NAIP2020_CONUS/ImageServer');
    expect(POSEY_2020_ASSETS.terrain.authorityClass).toBe('OBSERVATION');
    expect(POSEY_2020_ASSETS.terrain.derivationClass).toBe('RAW');
  });
});
```

- [ ] **Step 2: Run the focused test and verify the module is missing**

Run: `npm run test:cinematic -- tests/geospatial-asset-manifest.test.ts`
Expected: FAIL because the manifest module does not yet exist.

- [ ] **Step 3: Implement the manifest with exact source metadata**

Use typed constants for the AOI, source URLs, acquisition year, expected terrain pixel size (`0.30480060960121846` service representation), and NAIP 2020 0.6 m imagery metadata. Record the source URI separately from any runtime-derived export URI.

- [ ] **Step 4: Run the focused test**

Run: `npm run test:cinematic -- tests/geospatial-asset-manifest.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tsm-console/src/geospatial/site-asset-manifest.ts tsm-console/data/manifests/posey-2020-site-assets.json tsm-console/tests/geospatial-asset-manifest.test.ts
git commit -m "feat(geospatial): register authoritative Posey 2020 assets"
```

### Task 2: Add reproducible asset download and provenance hashing

**Files:**
- Create: `tsm-console/scripts/geospatial/fetch-posey-assets.mjs`
- Create: `tsm-console/scripts/geospatial/validate-raster-manifest.mjs`
- Modify: `tsm-console/.gitignore`
- Modify: `tsm-console/package.json`
- Test: `tsm-console/tests/geospatial-download-contract.test.ts`

**Interfaces:**
- `fetch-posey-assets.mjs` accepts `--output`, `--terrain-bbox`, and `--overwrite` and writes downloaded source/derived files plus a SHA-256 manifest.
- `validate-raster-manifest.mjs` validates CRS, dimensions, bounds, band count, and hashes without modifying the source.

- [ ] **Step 1: Add failing download-contract tests**

Test that the downloader contains the exact Indiana DEM and NAIP 2020 source URLs, refuses an AOI outside the registered 5,000-ft site bounds, and writes no asset into Git-tracked source directories.

- [ ] **Step 2: Implement the downloader using Node 20 `fetch` and `crypto`**

The terrain request uses the Indiana DEM ImageServer `exportImage` endpoint with `bboxSR=2966`, `imageSR=2966`, `format=tiff`, `pixelType=F32`. The orthophoto request uses the NAIP 2020 ImageServer `exportImage` endpoint with the same EPSG:2966 AOI and `format=jpgpng`. Save bytes under `data/geospatial/cache/posey-2020/` and compute SHA-256 over every materialized file.

- [ ] **Step 3: Add `.gitignore` protection**

Ignore `tsm-console/data/geospatial/cache/` and retain only manifests under `tsm-console/data/manifests/`.

- [ ] **Step 4: Add CLI scripts**

Add:

```json
"geospatial:fetch": "node scripts/geospatial/fetch-posey-assets.mjs",
"geospatial:validate": "node scripts/geospatial/validate-raster-manifest.mjs"
```

- [ ] **Step 5: Run contract tests and parser/type checks**

Run: `npm run check && npm run test:cinematic -- tests/geospatial-download-contract.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tsm-console/scripts/geospatial tsm-console/.gitignore tsm-console/package.json tsm-console/tests/geospatial-download-contract.test.ts
git commit -m "feat(geospatial): add reproducible Posey asset downloader"
```

### Task 3: Implement server-side raster export/proxy and provenance response

**Files:**
- Create: `tsm-console/server/geospatial/posey-assets.mjs`
- Modify: `tsm-console/server/token-proxy.mjs`
- Test: `tsm-console/tests/geospatial-api.test.mjs`

**Interfaces:**
- `GET /api/geospatial/posey/site` returns the registered manifest and current cache status.
- `GET /api/geospatial/posey/terrain?bbox=...&width=...&height=...` returns a GeoTIFF byte stream and provenance headers.
- `GET /api/geospatial/posey/orthophoto?bbox=...&width=...&height=...` returns a PNG/JPEG byte stream and provenance headers.
- Requests are constrained to the registered AOI; arbitrary proxying is forbidden.

- [ ] **Step 1: Write failing API contract tests**

Cover successful site metadata, AOI rejection with HTTP 400, and required provenance headers (`X-TSM-Source-URI`, `X-TSM-CRS`, `X-TSM-Vertical-Datum`, `X-TSM-Derivation-Class`).

- [ ] **Step 2: Implement bounded source fetches**

Use allowlisted source hosts and fixed service paths. Normalize query parameters server-side; never accept a user-supplied upstream URL.

- [ ] **Step 3: Add binary streaming response helpers**

Return the upstream content type and bytes while adding provenance headers. Set `Cache-Control` to a bounded cache policy and reject oversized requests.

- [ ] **Step 4: Run API tests**

Run: `node --test tests/geospatial-api.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tsm-console/server/geospatial/posey-assets.mjs tsm-console/server/token-proxy.mjs tsm-console/tests/geospatial-api.test.mjs
git commit -m "feat(geospatial): expose bounded Posey raster endpoints"
```

### Task 4: Decode the real terrain into a normalized source-derived grid

**Files:**
- Create: `tsm-console/src/geospatial/terrain-raster.ts`
- Create: `tsm-console/src/geospatial/terrain-grid.ts`
- Modify: `tsm-console/package.json`
- Test: `tsm-console/tests/geospatial-terrain-grid.test.ts`

**Interfaces:**
- `decodeTerrainGeoTiff(buffer): Promise<TerrainRaster>`
- `sampleTerrainGrid(raster, bounds, width, height): TerrainGrid`
- `TerrainGrid` contains EPSG:2966 bounds, NAVD88 elevations in US survey feet, width, height, and row-major `Float32Array` elevations.

- [ ] **Step 1: Add `geotiff` dependency and failing decoder tests**

Use a tiny generated GeoTIFF fixture in the test to verify CRS/bounds/elevation extraction without downloading the production raster.

- [ ] **Step 2: Implement GeoTIFF decoding**

Read the first raster, preserve its affine geotransform, reject missing CRS or non-finite elevations, and retain the source metadata required for provenance.

- [ ] **Step 3: Implement bounded grid sampling**

Downsample deterministically to a maximum of 256×256 for the viewport while preserving the source-derived min/max and AOI coordinates.

- [ ] **Step 4: Run focused terrain tests**

Run: `npm run test:cinematic -- tests/geospatial-terrain-grid.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tsm-console/src/geospatial/terrain-raster.ts tsm-console/src/geospatial/terrain-grid.ts tsm-console/package.json tsm-console/tests/geospatial-terrain-grid.test.ts
 git commit -m "feat(geospatial): decode Posey terrain into source-derived grid"
```

### Task 5: Bind terrain and orthophoto to the Three.js digital twin

**Files:**
- Create: `tsm-console/src/geospatial/terrain-mesh.tsx`
- Create: `tsm-console/src/geospatial/orthophoto-texture.ts`
- Modify: `tsm-console/src/routes/CinematicHudView.tsx`
- Test: `tsm-console/tests/geospatial-viewport-contract.test.ts`

**Interfaces:**
- `TerrainMesh({ grid, orthophotoUrl, waterStageFt })` renders the source-derived terrain mesh in local EPSG:2966 feet, centered on the AOI.
- `createOrthophotoTexture(imageBlob): Promise<THREE.Texture>` returns an RGB texture for the same AOI.

- [ ] **Step 1: Write failing viewport contract tests**

Assert the viewport imports the real terrain component, exposes the registered AOI, and no longer presents the empty 1,000×1,000 plane as the primary ground surface.

- [ ] **Step 2: Implement terrain mesh generation**

Build a `THREE.PlaneGeometry` vertex grid from the normalized elevations, map X/Y to the 5,000-ft EPSG:2966 AOI, and scale Z only for camera presentation. Keep the elevation value itself in NAVD88 feet for simulation/telemetry.

- [ ] **Step 3: Implement orthophoto texture binding**

Fetch the bounded `/api/geospatial/posey/orthophoto` endpoint, create an image texture, and map it to the terrain UVs. Do not stretch an unrelated image over the surface.

- [ ] **Step 4: Preserve hydraulic water visualization**

Position the water plane relative to the terrain's NAVD88 reference elevation instead of relative to an arbitrary zero plane.

- [ ] **Step 5: Run viewport tests and type checks**

Run: `npm run check && npm run test:cinematic -- tests/geospatial-viewport-contract.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tsm-console/src/geospatial/terrain-mesh.tsx tsm-console/src/geospatial/orthophoto-texture.ts tsm-console/src/routes/CinematicHudView.tsx tsm-console/tests/geospatial-viewport-contract.test.ts
git commit -m "feat(digital-twin): bind Posey terrain and orthophoto to viewport"
```

### Task 6: Feed the real terrain grid into Twin Solar Flood Tiles and pathfinding

**Files:**
- Create: `tsm-console/src/geospatial/tile-grid-adapter.ts`
- Modify: `tsm-console/src/digital-twin/twin-solar-flood-tiles.ts`
- Modify: `tsm-console/tests/twin-solar-pathfinding.test.ts`
- Test: `tsm-console/tests/geospatial-solar-integration.test.ts`

**Interfaces:**
- `terrainGridToSolarTiles(grid): readonly Tile[]`
- Each tile's `terrainHeight` is the source-derived NAVD88 elevation.
- Solar LOS uses the terrain grid, not a synthetic plane.

- [ ] **Step 1: Add failing integration tests**

Verify a 3×3 and 10×10 source-derived grid produces solar tiles whose `terrainHeight` matches the supplied elevation samples, and verify dirty-region recomputation only changes requested tile IDs.

- [ ] **Step 2: Implement the adapter**

Use deterministic row-major IDs and preserve EPSG:2966 grid spacing in tile width/height. Do not transform the elevation values into arbitrary visual units.

- [ ] **Step 3: Harden solar engine partial updates**

Retain the existing 0.85 propagation coefficient as a simulation parameter, but ensure direct LOS can inspect source-derived terrain heights. Keep `total_solar_yield` explicitly modeled/derived.

- [ ] **Step 4: Run solar and pathfinding tests**

Run: `npm run test:cinematic -- tests/twin-solar-pathfinding.test.ts tests/geospatial-solar-integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tsm-console/src/geospatial/tile-grid-adapter.ts tsm-console/src/digital-twin/twin-solar-flood-tiles.ts tsm-console/tests/twin-solar-pathfinding.test.ts tsm-console/tests/geospatial-solar-integration.test.ts
git commit -m "feat(digital-twin): drive solar and pathfinding from real terrain"
```

### Task 7: Add provenance telemetry and full validation

**Files:**
- Modify: `tsm-console/src/routes/CinematicHudView.tsx`
- Modify: `tsm-console/src/geospatial/site-asset-manifest.ts`
- Create: `tsm-console/tests/geospatial-provenance.test.ts`
- Modify: `tsm-console/README.md`

**Interfaces:**
- The viewport reports source status, acquisition year, CRS, vertical datum, AOI, and derivation class.
- It must display `OBSERVATION / RAW` for the authoritative terrain source and `DERIVED` for the rendered terrain grid/texture.

- [ ] **Step 1: Add failing provenance tests**

Verify every displayed terrain/orthophoto state can be traced to a manifest source URI and that no UI value claims evidentiary seal solely because it is rendered.

- [ ] **Step 2: Implement provenance telemetry**

Add an asset status panel and evidence-ledger entries for source fetch, decode, derived-grid creation, and render binding. Include hashes when materialized files exist.

- [ ] **Step 3: Update README with exact source chain**

Document the Indiana DEM source, Purdue reference LAS tile, 2020 NAIP source, AOI, CRS, vertical datum, cache policy, and commands:

```bash
npm run geospatial:fetch
npm run geospatial:validate
npm run check
npm test
npm run build
```

- [ ] **Step 4: Run the full validation suite**

Run: `npm test && npm run check && npm run build`
Expected: PASS with no TypeScript parse/type failures.

- [ ] **Step 5: Commit**

```bash
git add tsm-console/src/routes/CinematicHudView.tsx tsm-console/src/geospatial/site-asset-manifest.ts tsm-console/tests/geospatial-provenance.test.ts tsm-console/README.md
git commit -m "feat(provenance): expose Posey geospatial asset lineage"
```

## Final Verification

- Confirm `main` contains all seven implementation commits.
- Confirm no `.las`, `.tif`, `.tiff`, `.ecw`, `.sid`, or other large source binary was committed.
- Confirm the exact Purdue `IN2020_26800940_12.las` source URI is preserved in the manifest.
- Confirm runtime terrain comes from the Indiana 2016–2020 DEM ImageServer and orthophoto comes from 2020 NAIP.
- Confirm the same terrain grid feeds Three.js rendering and Twin Solar Flood Tiles/pathfinding.
- Confirm BFE/LAG/FFE remain separate configured parameters and are not derived from the raster.
- Confirm all automated tests, type checks, and production build pass before claiming completion.
