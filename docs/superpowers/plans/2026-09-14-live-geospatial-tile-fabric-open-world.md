# Live Geospatial Tile Fabric & Open-World Twin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate verified current geospatial, terrain, imagery, hydrologic, floodplain, infrastructure and historical evidence fabrics into TSM and expose them through provenance-aware live tile contracts to the Open-World 3D simulator.

**Architecture:** Extend the existing source registry/evidence ledger, MapLibre/Three.js twin and Node API with a typed geospatial-source and tile manifest layer. Authoritative services remain external; TSM stores compact manifests, hashes and provenance rather than bulk-committing restricted/large datasets. Runtime rendering uses verified current imagery/terrain, with explicit fallback and freshness states.

**Tech Stack:** React 19, TypeScript, Vite, MapLibre GL, Three.js, GeoTIFF, Node.js 22+, existing TSM ingestion/evidence/test infrastructure.

**Spec:** `docs/superpowers/specs/2026-09-14-community-river-valley-engineering-twin-design.md`

## Global Constraints

- Primary-source government products are preferred and provenance must travel with every derived/rendered dataset.
- FEMA effective mapping and Indiana Best Available Floodplain mapping remain separate evidence planes.
- Historical Point Township plats are reference evidence only and must not overwrite current cadastral/regulatory truth.
- Raw gage height remains in source datum; NAVD88 WSE is derived only with validated conversion metadata.
- Missing survey, datum transformation, model boundary condition, material qualification or authoritative source data fails closed.
- No synthetic production geospatial data may be represented as real-world observation.
- No private residence/address/property-specific engineering anchor may be propagated into public TSM identifiers or visualization.
- The Open-World Twin is decision-support visualization, not a survey, engineering certification, regulatory determination or emergency instruction.
- Large/license-restricted source datasets are referenced through authoritative services and compact manifests rather than bulk committed.
- New behavior requires automated contract tests before implementation is considered complete.

---

### Task 1: Establish canonical geospatial source and tile contracts

**Files:**
- Create: `data/schemas/geospatial-tile-fabric.schema.json`
- Create: `artifacts/tsm-geospatial-tile-fabric-v1.json`
- Modify: `tsm-console/src/data/poseyDataAcquisition.ts`
- Modify: `tsm-console/src/data/poseyEvidenceLedger.ts`
- Test: `tsm-console/tests/geospatial-tile-fabric-contract.test.mjs`

**Interfaces:**
- Produces `GeospatialTileAsset` metadata with `id`, `dataset`, `authority`, `layerType`, `sourceUrl`, `status`, `crs`, `verticalDatum`, `acquiredAt`, `effectiveAt`, `freshnessPolicy`, `provenanceClass`, `tileScheme`, and `verification`.
- Produces a manifest containing authoritative raster, elevation, vector, hydrology and historical-reference assets.

- [ ] Step 1: Write failing tests for required source classes, FEMA/BAFM separation, CRS/datum fields, and historical classification.
- [ ] Step 2: Run `npm run test:geospatial-tile-fabric` and verify the new contract test fails because the manifest/schema does not yet exist.
- [ ] Step 3: Implement the JSON schema and canonical manifest using the already verified TSM source registry entries.
- [ ] Step 4: Extend the Posey acquisition/evidence registries without changing existing public privacy boundaries.
- [ ] Step 5: Run the focused contract test and repository parse/type checks.
- [ ] Step 6: Commit with `feat: add canonical geospatial tile fabric contracts`.

### Task 2: Add authoritative raster/vector tile source adapters

**Files:**
- Create: `tsm-console/src/lib/geospatial-tile-sources.ts`
- Create: `tsm-console/src/lib/geospatial-tile-resolver.ts`
- Create: `tsm-console/tests/geospatial-tile-source-resolver.test.mjs`
- Modify: `tsm-console/src/lib/river-gauges.ts` only if shared source metadata requires a typed adapter export.

**Interfaces:**
- `resolveTileSource(layerId: string, now: Date): ResolvedTileSource`
- `getTileSourceManifest(): readonly GeospatialTileAsset[]`
- `ResolvedTileSource` contains URL template/service URL, source identity, freshness state, provenance class and fallback state.

- [ ] Step 1: Write failing resolver tests covering current source, stale source, unavailable source and historical fallback.
- [ ] Step 2: Run the focused resolver test and verify failure.
- [ ] Step 3: Implement strict source resolution with no fabricated fallback URLs.
- [ ] Step 4: Add explicit `LIVE`, `STALE`, `PROGRAM_PENDING`, `HISTORICAL`, and `SOURCE_UNAVAILABLE` states.
- [ ] Step 5: Run focused tests and `npm run check:type`.
- [ ] Step 6: Commit with `feat: add provenance-aware geospatial tile resolver`.

### Task 3: Build terrain and imagery runtime contracts

**Files:**
- Create: `tsm-console/src/lib/open-world-terrain.ts`
- Create: `tsm-console/src/lib/open-world-imagery.ts`
- Create: `tsm-console/tests/open-world-terrain-imagery.test.mjs`
- Modify: `docs/TERRAIN-RGB-3DEP-PIPELINE.md`

**Interfaces:**
- `getTerrainSource(now: Date): ResolvedTileSource`
- `getImagerySource(now: Date): ResolvedTileSource`
- `validateTerrainMetadata(metadata): TerrainMetadataValidation`

- [ ] Step 1: Write failing tests for 3DEP/current Indiana terrain metadata, current imagery metadata, and datum/CRS validation.
- [ ] Step 2: Run the focused tests and verify failure.
- [ ] Step 3: Implement metadata validation and source resolution using the manifest, not hard-coded synthetic terrain.
- [ ] Step 4: Update the terrain pipeline documentation to distinguish published/current acquisition from future program status.
- [ ] Step 5: Run focused tests plus `npm run check:geospatial`.
- [ ] Step 6: Commit with `feat: wire verified terrain and imagery sources`.

### Task 4: Integrate floodplain, parcels, PLSS, hydrography and infrastructure overlays

**Files:**
- Create: `tsm-console/src/lib/open-world-overlays.ts`
- Create: `tsm-console/tests/open-world-overlays.test.mjs`
- Modify: `tsm-console/src/components/RealWorldTwinMap.tsx`
- Modify: `docs/OPEN-WORLD-3D-TWIN-AND-HECRAS-MESH-v1.0.md`

**Interfaces:**
- `getOpenWorldOverlaySources(now: Date): readonly ResolvedTileSource[]`
- Overlay IDs include `fema-effective`, `indiana-bafm`, `parcels-2025`, `plss`, `roads`, `hydrography`, and `levee-embankment`.

- [ ] Step 1: Write failing tests asserting FEMA and BAFM are independently addressable and historical parcels cannot become current cadastral truth.
- [ ] Step 2: Run the focused test and verify failure.
- [ ] Step 3: Implement overlay source resolution from the canonical manifest.
- [ ] Step 4: Bind overlays to the existing RealWorldTwinMap layer lifecycle with explicit source-state metadata.
- [ ] Step 5: Run focused tests and `npm run test:twin`.
- [ ] Step 6: Commit with `feat: integrate authoritative open-world overlays`.

### Task 5: Synchronize live hydrology and forecast state into the 3D world

**Files:**
- Create: `tsm-console/src/lib/open-world-hydrology.ts`
- Create: `tsm-console/tests/open-world-hydrology.test.mjs`
- Modify: `tsm-console/server/ingestion/river-network-api.mjs`
- Modify: `tsm-console/src/components/RealWorldTwinMap.tsx`

**Interfaces:**
- `getOpenWorldHydrologicState(now: Date): Promise<OpenWorldHydrologicState>`
- State preserves station ID, observation/forecast class, timestamp, units, datum metadata, freshness and provenance.

- [ ] Step 1: Write failing tests for observed-versus-forecast separation, stale state and source-unavailable state.
- [ ] Step 2: Run the focused test and verify failure.
- [ ] Step 3: Reuse the existing river aggregation endpoint and expose a typed Open-World adapter rather than duplicating telemetry acquisition.
- [ ] Step 4: Bind live state to the twin as data overlays without turning telemetry into regulatory boundaries.
- [ ] Step 5: Run hydrology, river and twin tests.
- [ ] Step 6: Commit with `feat: synchronize live hydrology with open-world twin`.

### Task 6: Add terrain/imagery tile rendering and photorealistic scene composition

**Files:**
- Create: `tsm-console/src/components/OpenWorldTerrainLayer.tsx`
- Create: `tsm-console/src/components/OpenWorldImageryLayer.tsx`
- Modify: `tsm-console/src/components/RealWorldTwinMap.tsx`
- Create: `tsm-console/tests/open-world-visual-layer-contract.test.mjs`

**Interfaces:**
- `OpenWorldTerrainLayer` consumes `ResolvedTileSource` and emits no authoritative data itself.
- `OpenWorldImageryLayer` consumes imagery source metadata and reports source/freshness state.

- [ ] Step 1: Write failing component-contract tests for source binding and fallback-state display.
- [ ] Step 2: Run focused tests and verify failure.
- [ ] Step 3: Implement MapLibre raster/terrain source bindings and Three.js scene synchronization using existing renderer conventions.
- [ ] Step 4: Ensure terrain exaggeration is explicitly a visualization parameter and never alters engineering source elevation values.
- [ ] Step 5: Run focused tests and `npm run build`.
- [ ] Step 6: Commit with `feat: render authoritative terrain and imagery in open-world twin`.

### Task 7: Add historical Point Township replay/reconciliation layer

**Files:**
- Create: `tsm-console/src/lib/historical-point-township.ts`
- Create: `tsm-console/tests/historical-point-township.test.mjs`
- Modify: `docs/evidence/POSEY-POINT-TOWNSHIP-HISTORICAL-SOURCE-RECONCILIATION.md`

**Interfaces:**
- `getHistoricalPointTownshipLayers(): readonly ResolvedTileSource[]`
- Historical layers must carry `HISTORICAL_COMMUNITY_EVIDENCE` and never be returned as current cadastral/regulatory sources.

- [ ] Step 1: Write failing tests for historical classification and non-overwrite behavior.
- [ ] Step 2: Run focused tests and verify failure.
- [ ] Step 3: Implement the historical layer adapter using compact source metadata and the existing uploaded-map evidence classification.
- [ ] Step 4: Document visual comparison workflow against current parcels/imagery/PLSS.
- [ ] Step 5: Run focused tests and `npm run test:posey`.
- [ ] Step 6: Commit with `feat: add historical Point Township reconciliation layer`.

### Task 8: Add tile health, provenance and CI gates

**Files:**
- Create: `tsm-console/scripts/geospatial/tile-health-check.mjs`
- Create: `tsm-console/tests/tile-health-contract.test.mjs`
- Modify: `tsm-console/package.json`
- Modify: `.github/workflows/ci.yml` only after inspecting its exact current contract.
- Modify: `docs/REAL-TIME-DATA-OPERATIONS.md`

**Interfaces:**
- `npm run check:tile-health` validates manifest URLs, required metadata, freshness policy, CRS/datum declarations and source-state enums without requiring bulk source downloads.

- [ ] Step 1: Write failing tests for invalid source metadata, missing datum, stale source and duplicate layer IDs.
- [ ] Step 2: Run the focused test and verify failure.
- [ ] Step 3: Implement the health checker with network-independent manifest validation and optional HEAD/metadata checks only where CI policy permits.
- [ ] Step 4: Add the check to the existing CI sequence without weakening existing gates.
- [ ] Step 5: Run `npm run ci:full`.
- [ ] Step 6: Commit with `ci: enforce geospatial tile provenance contracts`.

### Task 9: End-to-end Open-World Twin verification and documentation

**Files:**
- Modify: `docs/OPEN-WORLD-3D-TWIN-AND-HECRAS-MESH-v1.0.md`
- Modify: `docs/DEPLOYMENT-AND-OPERATIONS.md`
- Modify: `README.md` only for verified runtime behavior.
- Test: existing twin/data-fabric/firm/geospatial/reliability suites.

- [ ] Step 1: Run the complete focused suite covering tile fabric, geospatial validation, twin, river, Posey and FIRM contracts.
- [ ] Step 2: Run `npm run ci:full` and capture the exact result.
- [ ] Step 3: Inspect generated artifacts and confirm no production mock/synthetic geospatial data was introduced.
- [ ] Step 4: Verify the workflow run and report success/failure using actual GitHub Actions evidence.
- [ ] Step 5: Update operational documentation with source-state behavior and tile-service deployment requirements.
- [ ] Step 6: Commit final documentation/verification changes with `docs: finalize live open-world tile fabric integration`.

## Verification Matrix

| Area | Required evidence |
|---|---|
| Source contracts | Canonical manifest + schema + provenance tests |
| Terrain | Published elevation source, CRS, vertical datum, acquisition metadata |
| Imagery | Published current imagery service, acquisition/retrieval metadata |
| Floodplain | FEMA effective and Indiana BAFM remain separate |
| Parcels | Indiana 2025 current parcel framework; historical atlas remains reference-only |
| Hydrology | USGS/NOAA source identity, timestamps, qualifiers, freshness |
| Historical replay | Explicit historical provenance class |
| Rendering | MapLibre/Three.js source-bound layers; no fabricated production terrain |
| CI | Parse, type, geospatial, twin, data-fabric, FIRM, reliability, mock-data and full test gates |
| Governance | Privacy, non-certification and human-review boundaries preserved |
