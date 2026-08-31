# FEMA FIRM Panel 18129C0265C Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the supplied FEMA FIRM panel 18129C0265C and its world-file into Tri-State Systems Manager as an evidence-first geospatial asset without promoting visual interpretation into authoritative regulatory truth.

**Architecture:** Preserve the supplied raster/image and world-file as source artifacts, register them in the Evidence Ledger, derive a georeferenced asset only after validating the world-file against authoritative panel metadata, and expose validated derivatives through the existing server/API and PTDT mapping stack. All derived flood-zone geometry and interpretations remain explicitly classified and traceable to the source evidence.

**Tech Stack:** Existing TypeScript/React/Vite/MapLibre console, Node services, PostgreSQL/PostGIS, SHA-256 evidence hashing, GeoJSON/COG-compatible derived artifacts where justified, GitHub Actions verification.

**Spec:** `docs/superpowers/specs/2026-08-20-tri-state-systems-manager-design.md`

## Global Constraints

- Authoritative evidence SHALL remain distinct from computational and visual products.
- Browser code SHALL NOT create authoritative cryptographic seals.
- SHA-256 SHALL be treated as an integrity mechanism, not proof of scientific truth or legal admissibility.
- FEMA NFHL and Indiana BAFM/FARA SHALL remain separate authority layers.
- Explicit CRS and vertical-reference metadata SHALL be preserved; horizontal and vertical reference systems SHALL NOT be conflated.
- Derived geometry SHALL retain source evidence IDs and transformation metadata.
- Failed or incomplete georeferencing validation SHALL fail closed and prevent authoritative publication.
- Essential public information SHALL remain available without WebGPU.

---

### Task 1: Register source artifacts and immutable evidence metadata

**Files:**
- Create: `data/fema/18129C0265C/README.md`
- Create: `data/fema/18129C0265C/manifest.json`
- Modify: existing evidence/source registry files identified by repository search
- Test: `tests/fema/source-manifest.test.ts`

**Interfaces:**
- `FIRMSourceManifest` records panel number, artifact names, source authority, acquisition timestamp, media types, SHA-256 hashes, and validation status.
- Source artifacts remain immutable inputs; no UI-derived values become source metadata.

- [ ] **Step 1: Write failing manifest-validation tests.**
- [ ] **Step 2: Run the focused test and confirm it fails before implementation.**
- [ ] **Step 3: Add the panel manifest schema and source metadata with explicit `UNVERIFIED_SOURCE` state until authoritative metadata comparison succeeds.**
- [ ] **Step 4: Calculate and record SHA-256 hashes for the supplied image and world-file without treating hashes as legal certification.**
- [ ] **Step 5: Run focused tests and commit `feat: register FEMA FIRM panel source artifacts`.**

### Task 2: Validate world-file georeferencing

**Files:**
- Create: `services/geospatial/src/world-file.ts`
- Create: `services/geospatial/src/firm-validation.ts`
- Create: `tests/geospatial/world-file.test.ts`
- Create: `tests/geospatial/firm-validation.test.ts`

**Interfaces:**
- `parseWorldFile(text): WorldFileTransform`
- `validateWorldFile(transform, rasterMetadata, authoritativePanelMetadata): ValidationResult`
- `buildGeoreferencedExtent(transform, rasterWidth, rasterHeight): BoundingBox`

- [ ] **Step 1: Write tests for six-parameter world-file parsing, pixel-center convention, axis orientation, malformed input rejection, and deterministic extent calculation.**
- [ ] **Step 2: Run tests and confirm failure.**
- [ ] **Step 3: Implement strict parsing with finite-number validation and explicit coordinate-order semantics.**
- [ ] **Step 4: Implement raster extent calculation and validation against authoritative panel bounds; reject mismatches beyond the documented tolerance rather than guessing.**
- [ ] **Step 5: Record transformation metadata and validation result.**
- [ ] **Step 6: Run focused geospatial tests and commit `feat: validate FIRM world-file georeferencing`.**

### Task 3: PostGIS FIRM asset and provenance model

**Files:**
- Create: `db/migrations/009_firm_assets.sql`
- Create: `packages/schemas/src/firm.ts`
- Create: `tests/db/firm-schema.test.ts`

**Interfaces:**
- `firm_panel` stores panel identifier, effective date, source evidence ID, spatial footprint, horizontal CRS metadata, vertical reference metadata, and validation status.
- `firm_derivative` stores derived artifact ID, source panel evidence ID, transformation chain, derivation software/version, and geometry classification.

- [ ] **Step 1: Write failing schema tests for source/derivative separation and spatial constraints.**
- [ ] **Step 2: Run the schema tests and confirm failure.**
- [ ] **Step 3: Add PostGIS tables, foreign keys, SRID/geometry constraints, evidence references, and spatial indexes.**
- [ ] **Step 4: Add constraints preventing publication of derivatives whose source validation status is not acceptable.**
- [ ] **Step 5: Run migration and spatial tests and commit `feat: add PostGIS FIRM asset model`.**

### Task 4: FIRM ingestion and derivative generation

**Files:**
- Create: `services/ingestion/src/sources/fema-firm-panel.ts`
- Create: `services/geospatial/src/firm-derivatives.ts`
- Create: `tests/ingestion/fema-firm-panel.test.ts`
- Create: `tests/geospatial/firm-derivatives.test.ts`

**Interfaces:**
- `ingestFirmPanel(source): Promise<FirmIngestionResult>`
- `deriveFirmPanelAsset(input): Promise<FirmDerivative>`

- [ ] **Step 1: Write fixture-based tests proving source artifacts are preserved and derivatives reference them.**
- [ ] **Step 2: Run tests and confirm failure.**
- [ ] **Step 3: Implement ingestion through the existing authority/evidence interfaces rather than browser fetches.**
- [ ] **Step 4: Generate a georeferenced derivative only after world-file and authoritative metadata validation succeeds.**
- [ ] **Step 5: Preserve raster provenance and classify the derivative as `DERIVED` or equivalent, not as the source itself.**
- [ ] **Step 6: Run ingestion and derivative tests and commit `feat: ingest validated FEMA FIRM panels`.**

### Task 5: Flood-zone/public map API integration

**Files:**
- Modify: existing `tsm-console/server` geospatial/evidence route modules identified by repository search
- Modify: `tsm-console/src/lib/map-layers.ts`
- Modify: existing router/map components identified by repository search
- Create: `tests/api/firm-route.test.ts`
- Create: `tests/frontend/firm-layer.test.ts`

**Interfaces:**
- `GET /api/geospatial/firm/panels/:panelId` returns panel metadata, validation status, evidence IDs, and available derived assets.
- `GET /api/geospatial/firm/panels/:panelId/layers` returns only validated/publicly releasable derived layers.

- [ ] **Step 1: Write failing API and frontend contract tests.**
- [ ] **Step 2: Run tests and confirm failure.**
- [ ] **Step 3: Add typed API responses and evidence-status labels.**
- [ ] **Step 4: Add the FIRM layer to the existing MapLibre layer registry with source attribution and provenance UI.**
- [ ] **Step 5: Add a non-WebGPU textual/table representation of panel metadata and derived flood-zone information.**
- [ ] **Step 6: Ensure unvalidated derivatives cannot be returned by public routes.**
- [ ] **Step 7: Run API/frontend tests and commit `feat: expose FIRM flood layers in PTDT`.**

### Task 6: Hazard-mitigation and grant evidence linkage

**Files:**
- Modify: existing Posey County hazard/grant evidence modules identified by repository search
- Create: `docs/fema/18129C0265C-evidence-linkage.md`
- Create: `tests/grants/firm-evidence-linkage.test.ts`

**Interfaces:**
- `linkFirmEvidenceToProject(panelId, projectId): EvidenceLink`
- `evaluateFirmEvidenceAvailability(projectId): EvidenceAvailability`

- [ ] **Step 1: Write failing tests proving grant/hazard records can reference FIRM evidence without copying it into an authoritative claim.**
- [ ] **Step 2: Implement evidence links with explicit source/derived classifications.**
- [ ] **Step 3: Mark unsupported eligibility or regulatory conclusions as requiring human review and additional authority evidence.**
- [ ] **Step 4: Add documentation showing exactly which claims the panel supports and which it does not.**
- [ ] **Step 5: Run linkage tests and commit `feat: link FIRM evidence to mitigation workflows`.**

### Task 7: End-to-end verification and CI gate

**Files:**
- Create: `tests/e2e/firm-panel-integrity.test.ts`
- Modify: `.github/workflows/*` existing verification workflow selected by repository inspection
- Create: `docs/verification/FIRM-18129C0265C-VERIFICATION.md`

**Interfaces:**
- End-to-end verification proves source hash → georeferencing validation → PostGIS asset → derived artifact → API response → public map layer provenance.

- [ ] **Step 1: Write failing end-to-end integrity test.**
- [ ] **Step 2: Run the test and confirm the expected pre-integration failure.**
- [ ] **Step 3: Implement the complete verification chain.**
- [ ] **Step 4: Add CI execution for FIRM-specific validation and fail closed on georeferencing, hash, schema, or provenance failure.**
- [ ] **Step 5: Run the full relevant test suite, typecheck, lint, build, and security checks.**
- [ ] **Step 6: Commit `test: add end-to-end FIRM integrity verification`.**

## Acceptance Criteria

- The supplied 18129C0265C image and world-file are preserved as identifiable source artifacts.
- SHA-256 hashes are reproducible.
- World-file parsing is deterministic and rejects malformed input.
- Georeferencing is not published as authoritative until validated against authoritative panel metadata.
- PostGIS distinguishes source panel evidence from derived geometry.
- Public APIs expose evidence classification and provenance.
- MapLibre displays the FIRM layer with source attribution and a non-WebGPU alternative.
- Hazard/grant workflows reference the panel without inventing eligibility or legal conclusions.
- CI fails closed on integrity, CRS/georeferencing, schema, provenance, or build failures.
