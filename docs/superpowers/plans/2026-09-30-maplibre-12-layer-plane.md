# MapLibre 12-Layer Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the TSM MapLibre surface to a self-hosted Terrain-RGB source and a canonical 12-layer real-source geospatial fabric with interactive visibility controls.

**Architecture:** Keep MapLibre as the presentation plane. Terrain-RGB is the only terrain mesh source and remains fail-closed through the existing contract. The twelve overlays are described by typed source metadata and converted into MapLibre raster/GeoJSON sources without inventing data; FEMA effective and Indiana BAFM remain independent authority planes.

**Tech Stack:** React 19, TypeScript, Vite, MapLibre GL 6.11.2, existing TSM geospatial source contracts, ArcGIS REST services.

**Spec:** `docs/OPEN-WORLD-LIVE-TILE-FABRIC-v1.md` and `docs/superpowers/plans/2026-09-14-live-geospatial-tile-fabric-open-world.md`

## Global Constraints

- Self-hosted Terrain-RGB must use `VITE_TSM_TERRAIN_RGB_URL_TEMPLATE` and existing fail-closed validation.
- No synthetic production terrain or fabricated geospatial features.
- FEMA effective mapping and Indiana BAFM remain separate.
- Source authority/provenance metadata remains attached to each layer.
- Existing map behavior must remain functional when optional overlays are unavailable.
- Vector FeatureServer layers are fetched as GeoJSON by the client with bounded request sizes.
- No live river-gauge dependency is required for this map plane.

## Review Focus

- Missing/invalid Terrain-RGB URL must disable terrain mesh, not fall back to a public DEM.
- ArcGIS service failure must leave the map usable and mark the layer unavailable.
- FEMA and BAFM visibility must remain independently controllable.
- FeatureServer responses must be treated as untrusted display data and bounded.
- Layer registry IDs must be unique and all twelve entries must have non-placeholder real endpoints.

### Task 1: Canonical 12-layer registry

**Files:**
- Create: `tsm-console/src/lib/maplibre-layer-fabric.ts`
- Test: `tsm-console/tests/maplibre-layer-fabric.test.mjs`

**Interfaces:**
- `MAPLIBRE_FABRIC_LAYERS`: twelve immutable layer definitions.
- `getMapLibreFabricLayer(id)`
- `buildArcGisExportTemplate(endpoint, layerIds)`
- `buildArcGisFeatureQueryUrl(endpoint)`

- [ ] Write failing registry tests for exactly 12 unique IDs, real HTTPS endpoints, Terrain-RGB environment binding, and FEMA/BAFM separation.
- [ ] Run the focused test and verify it fails because the registry does not exist.
- [ ] Implement the registry and URL builders.
- [ ] Run the focused test and verify it passes.

### Task 2: MapLibre integration

**Files:**
- Modify: `tsm-console/src/components/RealWorldTwinMap.tsx`
- Modify: `tsm-console/src/lib/twin-map-style.ts`
- Test: `tsm-console/tests/maplibre-plane-contract.test.mjs`

- [ ] Write failing integration-contract tests for the twelve layer IDs and Terrain-RGB source wiring.
- [ ] Run the focused test and verify failure.
- [ ] Add the layer-control state and source lifecycle to `RealWorldTwinMap`.
- [ ] Add raster ArcGIS export layers and bounded FeatureServer GeoJSON refresh for vector layers.
- [ ] Keep existing FEMA/BAFM toggles synchronized with the new registry controls.
- [ ] Run focused tests.

### Task 3: Documentation and verification

**Files:**
- Create: `docs/MAPLIBRE-12-LAYER-PLANE.md`
- Modify: `tsm-console/MAPLIBRE-INTEGRATION.md`

- [ ] Document all twelve real endpoints, authority classes, and runtime behavior.
- [ ] Run TypeScript/build and focused MapLibre tests.
- [ ] Inspect the resulting diff for placeholder endpoints and unintended public DEM fallback.
- [ ] Commit and open a PR to `main`.
