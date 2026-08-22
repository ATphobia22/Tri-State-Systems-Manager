# Open-World Twin: Solar, Flood, Orthophoto & Local Tiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a provenance-first open-world visualization layer that synchronizes georeferenced orthophoto assets, solar lighting, validated flood scenarios, SceneState, WebGPU rendering, and local tile streaming.

**Architecture:** The implementation treats imagery, terrain, hydraulic scenarios, and lighting as separate authoritative inputs that converge into a typed `SceneState`. Flood scenarios are metadata-only until an evidence-backed raster/vector asset is bound; the renderer samples actual flood depth rather than substituting elevation thresholds. Local tiles are served through a bounded filesystem adapter so heavy assets remain outside the application bundle.

**Tech Stack:** TypeScript/React/Vite, WebGPU/WGSL, Node.js local tile server, Python/Rasterio-compatible GeoTIFF processing, JSON manifests, SHA-256 provenance identifiers.

**Spec:** `docs/superpowers/specs/2026-08-20-tri-state-systems-manager-design.md`

## Global Constraints

- Authoritative evidence SHALL remain distinct from computational and visual products.
- Flood scenario labels SHALL NOT imply verified elevations until a source/model asset is bound.
- Orthophoto CRS, bounds, resolution, dimensions, and nodata SHALL be read from the actual raster.
- Browser code SHALL NOT create authoritative cryptographic seals.
- Essential public information SHALL remain usable without WebGPU or high-bandwidth imagery.
- Solar coordinates SHALL remain configurable and provenance-tagged.
- CI SHALL fail closed on required validation failures.

### Task 1: Canonical SceneState and flood scenario contracts

**Files:** `tsm-console/src/lib/cinematic/scene-state.ts`, `tsm-console/src/lib/cinematic/flood-scenarios.ts`, tests.

- [ ] Add strict discriminated types for terrain, orthophoto, hydraulic, solar, and flood scenario state.
- [ ] Represent unbound 100-year/500-year/1937 scenarios without fabricated elevations.
- [ ] Test serialization and scenario selection.

### Task 2: Solar ephemeris

**Files:** `tsm-console/src/lib/cinematic/solar-engine.ts`, tests.

- [ ] Implement UTC-to-solar-position calculation with configurable latitude/longitude/time-zone offset.
- [ ] Return azimuth, elevation, and normalized renderer vector.
- [ ] Preserve source-supplied Mount Vernon coordinates as configuration rather than an immutable scientific constant.

### Task 3: WebGPU unified material

**Files:** `tsm-console/src/gpu/ultimate-twin-pipeline.wgsl`, tests/fixtures.

- [ ] Sample orthophoto UVs from georeferenced coordinates.
- [ ] Sample authoritative flood-depth texture when supplied.
- [ ] Apply solar diffuse lighting and ambient floor.
- [ ] Avoid hard-coded flood elevations.

### Task 4: Orthophoto metadata processing

**Files:** `tools/ortho/ortho_processor.py`, tests.

- [ ] Read actual GeoTIFF metadata through Rasterio.
- [ ] Validate CRS, bounds, resolution, dimensions, bands, nodata.
- [ ] Emit a deterministic manifest and tile layout metadata.

### Task 5: Local tile service

**Files:** `tsm-console/server/tiles/local-tile-server.mjs`, `local-tile-config.json`, tests/docs.

- [ ] Serve bounded XYZ raster/vector assets from a configured root.
- [ ] Prevent path traversal and arbitrary filesystem reads.
- [ ] Return cache headers and correct content types.

### Task 6: HUD controller contracts

**Files:** `tsm-console/src/lib/cinematic/controller.ts`, tests.

- [ ] Expose solar time and flood scenario updates through pure state transitions.
- [ ] Keep rendering state separate from authoritative evidence.

### Task 7: CI verification

- [ ] Run TypeScript tests/typecheck and Python syntax checks.
- [ ] Validate WGSL source structurally.
- [ ] Review changed files for hard-coded scientific claims and secrets.
- [ ] Open PR and wait for CI before merging.
