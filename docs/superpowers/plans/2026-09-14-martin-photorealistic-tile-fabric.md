# Martin Photorealistic 3D Tile Fabric Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the ATphobia22/martin tile-server capability into the TSM open-world geospatial fabric for provenance-controlled photorealistic imagery, terrain, vector overlays, and 3D Tiles delivery without conflating visualization data with engineering truth.

**Architecture:** Martin is the 2D/coverage/vector tile delivery plane for PostGIS, PMTiles, MBTiles, and approved raster/COG sources. OGC 3D Tiles remains a separate renderable-content contract for photogrammetry, buildings, point clouds, and other massive 3D content. TSM retains authoritative-source provenance, CRS/vertical-datum metadata, hydrology, HEC-RAS, and regulatory boundaries.

**Tech Stack:** Rust/Martin, MapLibre, PMTiles/MBTiles, PostGIS, COG where enabled, OGC 3D Tiles 1.1, TypeScript, JSON manifests, GitHub Actions.

**Spec:** `docs/OPEN-WORLD-LIVE-TILE-FABRIC-v1.md` and the existing `artifacts/tsm-geospatial-tile-fabric-v1.json`.

## Global Constraints

- Do not bulk-commit restricted government imagery or raster datasets.
- Preserve authoritative source URLs, retrieval timestamps, CRS, vertical datum, acquisition/effective dates, and SHA-256 provenance for materialized derivatives.
- Martin is a delivery/cache layer, not an engineering or regulatory authority.
- OGC 3D Tiles are visualization/streaming products; HEC-RAS and regulatory flood products remain independent evidence products.
- No secrets, database passwords, private tokens, or mutable production endpoints are committed.
- Do not claim 3D visualization data are survey-grade or regulatory-certified without independent engineering evidence.

---

### Task 1: Add Martin runtime configuration contract

**Files:**
- Create: `ops/martin/config.yaml`
- Create: `ops/martin/README.md`

**Interfaces:**
- Consumes `TSM_MARTIN_DATABASE_URL` and optional object-storage PMTiles environment variables.
- Produces a documented Martin source catalog for the open-world tile plane.

- [ ] Add environment-variable based PostgreSQL/PostGIS configuration.
- [ ] Add PMTiles directory/source configuration without embedding credentials.
- [ ] Add MapLibre style resource configuration.
- [ ] Document TLS, cache, health, and deployment requirements.

### Task 2: Add photorealistic/3D fabric manifest

**Files:**
- Create: `artifacts/tsm-3d-tiles-fabric-v1.json`

**Interfaces:**
- Consumes the existing geospatial source registry.
- Produces machine-readable contracts for imagery, terrain, vector overlays, and OGC 3D Tiles.

- [ ] Define source classes and rendering-only authority boundaries.
- [ ] Define CRS/vertical-datum/provenance requirements.
- [ ] Define LOD and cache metadata without inventing source resolutions.

### Task 3: Add TypeScript Martin/3D Tiles resolver

**Files:**
- Create: `tsm-console/src/lib/martin-tile-fabric.ts`
- Create: `tsm-console/tests/martin-tile-fabric.test.mjs`

**Interfaces:**
- `resolveMartinTileUrl(sourceId, z, x, y)` returns a deterministic tile URL only when the configured source is renderable.
- `resolveThreeDTilesetUrl(sourceId)` returns an OGC 3D Tiles tileset URL only for an explicitly configured 3D source.

- [ ] Implement strict source validation.
- [ ] Reject unknown or non-renderable sources.
- [ ] Keep live-observation telemetry out of static tile URL generation.
- [ ] Add tests for source resolution and failure states.

### Task 4: Integrate renderer-facing provenance

**Files:**
- Modify: `tsm-console/src/lib/geospatial-tile-sources.ts`
- Modify: `tsm-console/src/components/OpenWorldTerrainLayer.tsx`

- [ ] Preserve existing source state classification.
- [ ] Add explicit tile-plane metadata without changing engineering semantics.
- [ ] Keep terrain exaggeration strictly a visualization parameter.

### Task 5: CI and verification

**Files:**
- Modify: existing CI only if required by the new manifest/config tests.
- Create: `docs/superpowers/verification/2026-09-14-martin-photorealistic-tile-fabric.md`

- [ ] Validate JSON/YAML/config contracts.
- [ ] Run targeted TypeScript tests.
- [ ] Run the full repository CI workflow.
- [ ] Record exact commit and workflow run IDs.
- [ ] Do not report completion until the authoritative GitHub Actions result is green.
