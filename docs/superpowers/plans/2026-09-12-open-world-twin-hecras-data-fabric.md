# Open-World 3D Twin and HEC-RAS Data Fabric Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace synthetic geospatial visualization with a real-source Indiana open-world twin, formalize HEC-RAS 2D mesh and evidence contracts, wire live hydrology and distinct flood authorities, and harden build/run/workflow/deployment paths.

**Architecture:** MapLibre is the authoritative browser geospatial renderer, consuming Indiana current imagery plus Terrain-RGB `raster-dem` tiles and separate FEMA NFHL/Indiana BAFM overlays. HEC-RAS geometry, terrain, boundary conditions, and derived outputs are governed as evidence/model artifacts; live hydrology flows through the existing NOAA-first/USGS fallback API and is transformed to NAVD88 only through explicit datum metadata. The Node API remains separately deployable from GitHub Pages, with configurable `VITE_TSM_API_BASE_URL` and explicit fail-closed behavior.

**Tech Stack:** React 19, TypeScript, Vite, MapLibre GL JS, Three.js/React Three Fiber where specialized 3D remains justified, Node HTTP API, GitHub Actions, Docker/Martin/PMTiles, GDAL, rio-rgbify, USGS 3DEP/TNMAccess, Indiana ArcGIS ImageServer/FeatureServer, FEMA NFHL, NOAA NWPS, USACE HEC-RAS 2D.

**Spec:** `docs/OPEN-WORLD-3D-TWIN-AND-HECRAS-MESH-v1.0.md`, `data/schemas/tsm-indiana-data-catalog-v1.json`, and the approved 2026-09-12 user specification.

## Global Constraints

- Live stage chain remains NOAA NWPS first, then USGS; provisional `P` must remain visible.
- USGS modern Water Data APIs are the runtime target; legacy WaterServices is compatibility/evidence only.
- FEMA NFHL and Indiana BAFM remain separate authority planes and must never be collapsed into one flood-zone value.
- 3DEP terrain is source-backed; no synthetic terrain or fabricated production elevation.
- Indiana Current Imagery is the primary photorealistic surface source.
- HEC-RAS mesh dimensions are nominal refinement targets, not universal regulatory requirements.
- HEC-RAS outputs are simulation/model outputs and require human review; no automatic regulatory determination.
- Terrain/data acquisitions use EvidenceArtifacts and SHA-256 provenance rather than committing bulk source datasets.
- NLD remains read-only evidence and does not confer accreditation.
- TSM contains no medical/clinical subsystem; medical functionality remains outside this product boundary.
- All production code changes require tests first; when local execution is unavailable, GitHub Actions is the verification authority and claims must be limited to observed workflow results.
- All changes are committed directly to `main`, per user approval.

---

### Task 1: Establish failing contract tests for the real-source twin

**Files:**
- Create: `tsm-console/tests/open-world-twin-contract.test.mjs`
- Modify: `tsm-console/tests/data-fabric-contract.test.mjs` if required to share source-contract assertions

**Interfaces:**
- Consumes: repository source files and documented service URLs.
- Produces: executable checks proving the twin uses real Indiana imagery/terrain sources, keeps FEMA and BAFM separate, and exposes HEC-RAS authority labels.

- [ ] **Step 1: Write failing tests** for: Indiana current imagery URL; `raster-dem`/Terrain-RGB configuration; distinct NFHL and BAFM layer identifiers; absence of synthetic terrain primitives in the production twin; required site constants; HEC-RAS `SIMULATION_DEMO`/human-review metadata.
- [ ] **Step 2: Push the tests and use GitHub Actions to observe the expected RED failure before implementation.** Local execution is unavailable in this environment, so do not claim a local failure.
- [ ] **Step 3: Commit the failing test as an isolated test commit.**

### Task 2: Build the MapLibre real-world twin renderer

**Files:**
- Modify: `tsm-console/src/routes/TwinCanvasView.tsx`
- Create: `tsm-console/src/components/RealWorldTwinMap.tsx`
- Create: `tsm-console/src/lib/twin-map-style.ts`
- Modify: `tsm-console/src/lib/map-layers.ts`

**Interfaces:**
- Consumes: `MapTwinLoaderData`, live stage data, source-contract registry, site constants.
- Produces: accessible MapLibre twin with imagery, terrain, distinct flood overlays, live WSE, and provenance labels.

- [ ] **Step 1: Implement the minimal renderer that satisfies the new contract tests.**
- [ ] **Step 2: Configure Indiana Current Imagery ImageServer as the photorealistic base source without downloading bulk imagery into Git.
- [ ] **Step 3: Configure Terrain-RGB as MapLibre `raster-dem` and bind `setTerrain()` through a deployment-configurable tile URL.
- [ ] **Step 4: Add distinct FEMA NFHL and Indiana BAFM sources/layers with separate legends and authority badges.
- [ ] **Step 5: Bind live observed stage/WSE and site constants without fabricating terrain or flood extents.
- [ ] **Step 6: Preserve React Router lazy loading and remove obsolete synthetic TwinCanvas geometry.
- [ ] **Step 7: Run the focused contract workflow and then full CI; fix every observed failure before proceeding.
- [ ] **Step 8: Commit the renderer changes.

### Task 3: Formalize terrain acquisition and Terrain-RGB pipeline

**Files:**
- Create: `docs/TERRAIN-RGB-3DEP-PIPELINE.md`
- Create: `tsm-console/config/terrain-pipeline.json`
- Modify: Docker/Martin configuration files discovered during audit
- Modify: source registry files discovered during audit

**Interfaces:**
- Consumes: USGS 3DEP/TNMAccess authoritative products.
- Produces: deterministic acquisition/reprojection/encoding/tile-serving contract with SHA-256 EvidenceArtifact metadata.

- [ ] **Step 1: Add tests for source URL, tile encoding parameters, no-bulk-asset policy, and provenance requirements.
- [ ] **Step 2: Define `gdalwarp -> rio-rgbify -> PMTiles/XYZ -> Martin -> MapLibre raster-dem` with explicit CRS and zoom/extent rules.
- [ ] **Step 3: Define SHA-256 acquisition manifests and fail-closed metadata for missing source/version/hash.
- [ ] **Step 4: Add the pipeline documentation and configuration without committing source raster payloads.
- [ ] **Step 5: Run repository integrity and full CI checks; commit.

### Task 4: Formalize HEC-RAS 2D mesh and engineering contracts

**Files:**
- Create or update: `docs/OPEN-WORLD-3D-TWIN-AND-HECRAS-MESH-v1.0.md`
- Create: `data/schemas/hec-ras-2d-project-contract.json`
- Create: `data/schemas/hec-ras-2d-boundary-conditions.schema.json`
- Create: `data/schemas/hec-ras-2d-evidence-artifact.schema.json`
- Create: `tsm-console/src/lib/hec-ras-contracts.ts`
- Create: `tsm-console/tests/hec-ras-contract.test.mjs`

**Interfaces:**
- Consumes: project profile constants, gage identity/datum metadata, source catalog.
- Produces: validated model-input/output contract with nominal mesh zones, breaklines, terrain requirements, boundary-condition provenance, and human-review gates.

- [ ] **Step 1: Write failing contract tests for all mesh bands, breaklines, terrain requirements, constants, and simulation authority.
- [ ] **Step 2: Define machine-readable schemas with explicit units and vertical datum fields.
- [ ] **Step 3: Implement TypeScript validation/normalization with explicit errors for invalid mesh ranges, missing provenance, mixed datum metadata, or regulatory authority claims.
- [ ] **Step 4: Encode the approved project constants: LAG 377.2 ft, BFE 375.0 ft, berm crest 379.8 ft, FFE 382.5 ft; retain project-profile provenance.
- [ ] **Step 5: Document sub-grid property tables and breakline strategy; identify the cell sizes as nominal engineering refinement targets.
- [ ] **Step 6: Run focused tests and full CI; commit.

### Task 5: Wire evidence hashing for terrain, model inputs, and outputs

**Files:**
- Modify: `tsm-console/server/store/evidence-store.mjs`
- Modify: evidence schemas/types discovered during audit
- Create: `tsm-console/tests/evidence-artifact-contract.test.mjs`

**Interfaces:**
- Consumes: source payloads, HEC-RAS manifests, terrain acquisition manifests.
- Produces: SHA-256 content-addressed EvidenceArtifacts with source, derivation, validation, and human-review metadata.

- [ ] **Step 1: Write failing tests for required evidence fields, deterministic hashing, simulation labeling, and verification mismatch behavior.
- [ ] **Step 2: Implement the smallest compatible artifact validation/hashing changes.
- [ ] **Step 3: Ensure HEC-RAS outputs cannot be marked regulatory/authoritative by model metadata alone.
- [ ] **Step 4: Run focused and full CI; commit.

### Task 6: Complete live hydrology and WSE wiring

**Files:**
- Modify: `tsm-console/server/token-proxy.mjs`
- Modify: `tsm-console/src/lib/stage.ts`
- Modify: `tsm-console/src/types/loaders.ts`
- Modify: `tsm-console/src/lib/router.tsx` or loader implementation as needed
- Modify: `tsm-console/src/components/RootLayout.tsx`
- Modify: `tsm-console/tests/data-fabric-contract.test.mjs`

**Interfaces:**
- Consumes: NOAA NWPS `NHRI3`, USGS `03378500`, gage datum metadata.
- Produces: typed live telemetry with source, qualifier, discharge, observed/retrieved timestamps, vertical reference, and fail-closed status.

- [ ] **Step 1: Write failing tests for NOAA-first selection, USGS fallback, `P` propagation, discharge, and root-loader exposure.
- [ ] **Step 2: Verify and correct loader types and server response shape.
- [ ] **Step 3: Implement explicit observed-stage-to-WSE metadata using the curated 352.71 ft NAVD88 gage-zero constant; never silently change datum.
- [ ] **Step 4: Keep the exact 2026-09-12 snapshot as evidence, but require runtime refresh for operational display.
- [ ] **Step 5: Run focused and full CI; commit.

### Task 7: Audit and harden geospatial source registry

**Files:**
- Modify: `tsm-console/src/lib/source-contracts.mjs` or equivalent
- Modify: `tsm-console/src/lib/source-fabric.ts` or equivalent
- Modify: `tsm-console/src/lib/map-layers.ts`
- Modify: `data/schemas/tsm-indiana-data-catalog-v1.json`

**Interfaces:**
- Consumes: authoritative public service metadata.
- Produces: allowlisted, provenance-aware source registry covering USGS, NOAA, FEMA, Indiana BAFM, current parcels, PLSS, CSLF, 3DEP/TNM, imagery, and NLD.

- [ ] **Step 1: Write failing tests for current parcel service priority, source URL allowlists, and FEMA/BAFM authority separation.
- [ ] **Step 2: Promote Indiana Current Parcel Boundaries to primary and retain 2023 only as historical fallback.
- [ ] **Step 3: Correct stale terrain/imagery endpoints in geospatial APIs where the current service is authoritative.
- [ ] **Step 4: Ensure NLD is read-only evidence.
- [ ] **Step 5: Run source-contract and full CI; commit.

### Task 8: Remove synthetic/mock production data and stale wiring

**Files:**
- Modify/delete only files found by the audit: synthetic parcel fallback, mock terrain, obsolete API fallbacks, stale route components, stale documentation.
- Modify: tests to enforce no synthetic production geometry.

**Interfaces:**
- Consumes: repository-wide search results.
- Produces: production paths that fail closed instead of silently substituting fabricated geospatial data.

- [ ] **Step 1: Write failing regression tests against every identified synthetic production path.
- [ ] **Step 2: Remove or gate those paths behind explicit non-production test fixtures.
- [ ] **Step 3: Remove dead imports/routes/configuration and update references.
- [ ] **Step 4: Run parse/typecheck/build and full CI through GitHub Actions; commit fixes until green.

### Task 9: Build/run/deploy workflow hardening

**Files:**
- Modify: `.github/workflows/*.yml`
- Modify: `tsm-console/package.json`
- Modify: Docker/Martin/deployment files discovered during audit
- Modify: deployment documentation

**Interfaces:**
- Consumes: application build artifacts and runtime environment variables.
- Produces: reproducible CI, static frontend deployment, separately deployable Node API/tile services, and explicit health checks.

- [ ] **Step 1: Add failing workflow/configuration tests for API base URL, required Node version, build scripts, and deployment separation.
- [ ] **Step 2: Verify Pages builds only the static frontend and never assumes Node API execution.
- [ ] **Step 3: Verify `VITE_TSM_API_BASE_URL` behavior for same-origin development and production API origins.
- [ ] **Step 4: Verify Martin/PMTiles configuration and fail-closed behavior when terrain tiles are not configured.
- [ ] **Step 5: Run all GitHub Actions workflows and inspect actual job results, artifacts, and logs.
- [ ] **Step 6: Fix every build/run/workflow/action error discovered and repeat verification.
- [ ] **Step 7: Commit final workflow/deployment changes.

### Task 10: Documentation, repository cleanup, and final verification

**Files:**
- Modify: `README.md`
- Modify: `docs/REAL-TIME-DATA-OPERATIONS.md`
- Modify: `docs/OPEN-WORLD-3D-TWIN-AND-HECRAS-MESH-v1.0.md`
- Modify: data catalog README/artifacts as needed
- Remove obsolete files only after repository-wide reference search

**Interfaces:**
- Consumes: final implementation and observed CI results.
- Produces: accurate operational documentation with no claims unsupported by runtime/configuration evidence.

- [ ] **Step 1: Run repository-wide stale-reference, mock-data, secret, clinical-boundary, and broken-link checks.
- [ ] **Step 2: Update README with actual build/run/deploy commands and explicit API/tile service requirements.
- [ ] **Step 3: Ensure all authority and simulation labels are documented consistently.
- [ ] **Step 4: Run final GitHub Actions suite and inspect the final `main` commit status.
- [ ] **Step 5: Confirm working-tree-equivalent repository state through GitHub file/commit comparison; no uncommitted local state exists because changes are written directly to `main`.
- [ ] **Step 6: Commit final cleanup and report only verified completion status.

## Verification Matrix

- Source contracts: authoritative endpoint and authority-class tests.
- Hydrology: NOAA-first, USGS fallback, qualifier/discharge/WSE metadata.
- Flood mapping: independent NFHL and BAFM layers/legends.
- Terrain: real Indiana imagery + 3DEP Terrain-RGB contract; no synthetic production terrain.
- HEC-RAS: mesh bands, breaklines, terrain, boundaries, constants, evidence, human review.
- Security: secret scan, source allowlists, no client secrets, request-size/error handling.
- Build: parse, typecheck, Vite build.
- Runtime: API health/readiness and static frontend/API separation.
- Actions: all applicable workflows green on final `main` head.
- Documentation: README and operational docs match actual implementation.

## Spec Coverage Self-Review

- Live 03378500 telemetry and provisional qualifier: Task 6.
- FEMA NFHL effective/insurance plane: Tasks 2 and 7.
- Indiana BAFM planning/Flood Control Act plane: Tasks 2 and 7.
- HEC-RAS mesh sizing: Task 4.
- 3DEP 1-m/hydro-enforced terrain: Tasks 3 and 4.
- Breaklines and project constants: Task 4.
- Sub-grid property tables: Task 4.
- Simulation/evidence gating: Tasks 4 and 5.
- Indiana Current Imagery: Task 2.
- Terrain-RGB/MapLibre/Martin/PMTiles pipeline: Tasks 2 and 3.
- Live WSE: Tasks 2 and 6.
- Site constants: Task 4.
- No bulk planet-scale asset generation: Task 3.
- Build/run/deploy hardening: Task 9.
- Repository cleanup/commit: Task 10.
