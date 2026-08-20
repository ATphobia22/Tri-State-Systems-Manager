# Tri-State Systems Manager Production Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing Tri-State Systems Manager repository into a production-grade evidence-first public-interest platform with authoritative ingestion, PostGIS data governance, an immutable evidence ledger, versioned regulatory evaluation, governed AI, community-benefit analysis, typed APIs, WebGPU visualization, accessibility, and CI/CD verification.

**Architecture:** Keep the existing React/MapLibre console as the primary visualization client while moving authoritative ingestion, evidence sealing, regulatory evaluation, and provenance into server-side services. PostgreSQL/PostGIS stores normalized metadata and spatial state; S3-compatible object storage stores large immutable artifacts; workers ingest authoritative sources; all derived computation references evidence IDs without mutating source truth.

**Tech Stack:** TypeScript/React 19/Vite/MapLibre, Node server services, PostgreSQL/PostGIS, S3-compatible object storage, Redis-compatible queues, OpenAPI/JSON Schema/GeoJSON/OGC APIs, WebGPU/Three.js where useful, OpenTelemetry, Docker, GitHub Actions, security/dependency scanning.

**Spec:** `docs/superpowers/specs/2026-08-20-tri-state-systems-manager-design.md`

## Global Constraints

- Authoritative evidence SHALL remain distinct from computational and visual products.
- Browser code SHALL NOT create authoritative cryptographic seals.
- SHA-256 SHALL be treated as an integrity mechanism, not proof of scientific truth or legal admissibility.
- USGS observations and NOAA forecasts SHALL remain separate data classes.
- FEMA NFHL, Indiana BAFM, FARA/eFARA, and supporting terrain/hydrology SHALL remain separate authority nodes.
- XSoft cadastral data SHALL remain provisional until independently validated.
- Regulatory rules SHALL be versioned backend policy data, not React conditionals.
- AI SHALL NOT silently modify authoritative evidence or make legally reserved decisions.
- Essential public information SHALL remain usable without WebGPU, JavaScript-heavy rendering, or high-bandwidth imagery.
- All consequential state transitions SHALL be auditable and reproducible.
- CI SHALL fail closed on required validation failures.

---

### Task 1: Repository foundation and workspace boundaries

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `packages/schemas/src/index.ts`
- Create: `packages/config/src/index.ts`
- Create: `packages/config/src/env.ts`
- Create: `tests/foundation/config.test.ts`
- Modify: `tsm-console/package.json`

**Interfaces:**
- Produces shared workspace scripts and typed environment configuration consumed by all later services.
- Produces `EvidenceClass`, `AuthorityStatus`, `ValidationStatus`, and `SourceKind` schema enums.

- [ ] **Step 1: Write the failing configuration test**

```ts
import { describe, expect, it } from 'vitest';
import { parseEnvironment } from '../../packages/config/src/env';

describe('environment contract', () => {
  it('rejects production configuration without database and object storage settings', () => {
    expect(() => parseEnvironment({ NODE_ENV: 'production' })).toThrow();
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm vitest tests/foundation/config.test.ts --run`
Expected: FAIL because the shared environment parser does not yet exist.

- [ ] **Step 3: Implement the minimal workspace and environment contract**

Define a strict environment parser with explicit production requirements and no `any` types. Add workspace scripts for `typecheck`, `test`, `lint`, `build`, and `security`.

- [ ] **Step 4: Run the test and typecheck**

Run: `pnpm vitest tests/foundation/config.test.ts --run && pnpm -r typecheck`
Expected: PASS with no implicit-any errors.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json packages tests tsm-console/package.json
git commit -m "chore: establish production workspace foundation"
```

### Task 2: Evidence ledger and provenance graph

**Files:**
- Create: `packages/schemas/src/evidence.ts`
- Create: `services/evidence-ledger/src/hash.ts`
- Create: `services/evidence-ledger/src/ledger.ts`
- Create: `services/evidence-ledger/src/provenance.ts`
- Create: `services/evidence-ledger/src/verify.ts`
- Create: `services/evidence-ledger/src/index.ts`
- Create: `tests/evidence/ledger.test.ts`
- Create: `tests/evidence/provenance.test.ts`

**Interfaces:**
- `createEvidenceRecord(input): EvidenceRecord`
- `appendEvidence(record): Promise<LedgerEntry>`
- `verifyEvidence(entry): Promise<VerificationResult>`
- `linkProvenance(parentId, childId, relation): Promise<void>`

- [ ] **Step 1: Write failing tests for deterministic hashing, append-only sequencing, and provenance**
- [ ] **Step 2: Run `pnpm vitest tests/evidence --run` and confirm failure**
- [ ] **Step 3: Implement canonical serialization and SHA-256 hashing using Node's cryptographic API**
- [ ] **Step 4: Implement append-only ledger entries containing previous-entry hash, content hash, timestamps, source metadata, and validation state**
- [ ] **Step 5: Implement provenance edges and verification without calling the hash a legal certification**
- [ ] **Step 6: Run evidence tests and a deterministic repeatability test**
- [ ] **Step 7: Commit `feat: establish immutable evidence ledger`**

### Task 3: PostgreSQL/PostGIS schema and migrations

**Files:**
- Create: `db/migrations/001_extensions.sql`
- Create: `db/migrations/002_authority.sql`
- Create: `db/migrations/003_evidence.sql`
- Create: `db/migrations/004_observations.sql`
- Create: `db/migrations/005_geospatial.sql`
- Create: `db/migrations/006_regulatory.sql`
- Create: `db/migrations/007_audit.sql`
- Create: `db/migrations/008_community_graph.sql`
- Create: `tests/db/schema.test.ts`

**Interfaces:**
- Tables: `authority_source`, `evidence_artifact`, `evidence_provenance`, `hydrologic_observation`, `geospatial_asset`, `regulatory_rule`, `regulatory_finding`, `audit_event`, `community_node`, `community_edge`.
- PostGIS geometries SHALL carry SRID and geometry type constraints.

- [ ] **Step 1: Write failing migration verification tests**
- [ ] **Step 2: Run the migration test against an isolated PostgreSQL/PostGIS test database and confirm missing tables**
- [ ] **Step 3: Add extensions and normalized tables with foreign keys, unique source identifiers, timestamps, hashes, status fields, and spatial indexes**
- [ ] **Step 4: Add indexes for observation time, authority source, provenance traversal, and spatial intersection queries**
- [ ] **Step 5: Add constraints preventing invalid evidence classes and orphan provenance edges**
- [ ] **Step 6: Run migration, schema, and representative spatial-query tests**
- [ ] **Step 7: Commit `feat: add PostGIS evidence data plane`**

### Task 4: Object storage and artifact lifecycle

**Files:**
- Create: `services/object-store/src/client.ts`
- Create: `services/object-store/src/artifacts.ts`
- Create: `services/object-store/src/manifest.ts`
- Create: `tests/object-store/artifacts.test.ts`
- Create: `infrastructure/docker/minio/README.md`

**Interfaces:**
- `putArtifact(input): Promise<StoredArtifact>`
- `getArtifact(id): Promise<ArtifactStream>`
- `createManifest(ids): Promise<ArtifactManifest>`

- [ ] **Step 1: Write failing tests for content-addressed storage and manifest generation**
- [ ] **Step 2: Run focused tests and confirm failure**
- [ ] **Step 3: Implement S3-compatible storage using explicit bucket/key configuration and content-type validation**
- [ ] **Step 4: Generate manifests from stored artifact hashes and metadata**
- [ ] **Step 5: Reject executable content and oversized/untrusted uploads at the service boundary**
- [ ] **Step 6: Run object-store integration tests against local S3-compatible infrastructure**
- [ ] **Step 7: Commit `feat: add immutable artifact storage`**

### Task 5: Authoritative ingestion workers

**Files:**
- Create: `services/ingestion/src/core/http.ts`
- Create: `services/ingestion/src/core/worker.ts`
- Create: `services/ingestion/src/sources/usgs-nwis.ts`
- Create: `services/ingestion/src/sources/noaa-nwps.ts`
- Create: `services/ingestion/src/sources/noaa-nws.ts`
- Create: `services/ingestion/src/sources/fema-nfhl.ts`
- Create: `services/ingestion/src/sources/indiana-gio.ts`
- Create: `services/ingestion/src/sources/indiana-dnr.ts`
- Create: `services/ingestion/src/sources/indiana-parcels.ts`
- Create: `services/ingestion/src/sources/grants.ts`
- Create: `services/ingestion/src/registry.ts`
- Create: `tests/ingestion/usgs.test.ts`
- Create: `tests/ingestion/fail-closed.test.ts`

**Interfaces:**
- `SourceAdapter.fetch(request): Promise<SourcePayload>`
- `normalize(payload): Promise<NormalizedArtifact[]>`
- `ingest(adapter, context): Promise<IngestionResult>`

- [ ] **Step 1: Write failing tests using fixture payloads for USGS observation and NOAA forecast data**
- [ ] **Step 2: Run focused ingestion tests and verify failure**
- [ ] **Step 3: Implement strict HTTP handling that rejects unexpected HTML when JSON/XML/raster is required**
- [ ] **Step 4: Implement USGS 03378500 and 03322000 adapters using authority-registry metadata rather than hard-coded UI telemetry**
- [ ] **Step 5: Implement NOAA NWPS/NWS adapters while keeping forecast and observation classes separate**
- [ ] **Step 6: Implement FEMA, Indiana GIO, Indiana DNR, parcel, and grant adapters as independently testable source modules**
- [ ] **Step 7: Persist raw/reference artifacts, normalized records, provenance, and hashes through the evidence ledger and PostGIS services**
- [ ] **Step 8: Implement fail-closed cache fallback with explicit `CACHED_UNVERIFIED` or equivalent status when live authority validation fails**
- [ ] **Step 9: Run adapter, failure, schema, and integration tests**
- [ ] **Step 10: Commit `feat: implement authoritative ingestion fabric`**

### Task 6: Versioned regulatory rule engine

**Files:**
- Create: `regulatory/schema/rule.schema.json`
- Create: `regulatory/rules/indiana/*.json`
- Create: `regulatory/rules/illinois/*.json`
- Create: `regulatory/rules/kentucky/*.json`
- Create: `regulatory/rules/federal/*.json`
- Create: `services/regulatory-engine/src/compiler.ts`
- Create: `services/regulatory-engine/src/evaluate.ts`
- Create: `services/regulatory-engine/src/explain.ts`
- Create: `tests/regulatory/evaluate.test.ts`
- Create: `tests/regulatory/provenance.test.ts`

**Interfaces:**
- `compileRuleSet(version): CompiledRuleSet`
- `evaluate(context, rules): RegulatoryEvaluation`
- `explain(evaluation): EvidenceBackedExplanation`

- [ ] **Step 1: Write failing deterministic rule tests using explicit units and authority metadata**
- [ ] **Step 2: Run tests and confirm failure**
- [ ] **Step 3: Define versioned rule schema with jurisdiction, authority, citation, effective date, inputs, units, threshold, evaluation expression, and review status**
- [ ] **Step 4: Load initial Indiana-first rules and explicit federal/IL/KY overlays only from verified source material**
- [ ] **Step 5: Implement deterministic evaluation and evidence-backed explanations**
- [ ] **Step 6: Ensure the engine rejects insufficient or stale evidence instead of producing a false compliance determination**
- [ ] **Step 7: Run rule, provenance, boundary, and missing-evidence tests**
- [ ] **Step 8: Commit `feat: add governed regulatory rule engine`**

### Task 7: API, authentication, audit, and realtime state

**Files:**
- Create: `services/api/src/app.ts`
- Create: `services/api/src/routes/evidence.ts`
- Create: `services/api/src/routes/observations.ts`
- Create: `services/api/src/routes/geospatial.ts`
- Create: `services/api/src/routes/regulatory.ts`
- Create: `services/api/src/routes/community.ts`
- Create: `services/api/src/routes/public.ts`
- Create: `services/api/src/realtime/router.ts`
- Create: `services/api/openapi.yaml`
- Create: `tests/api/contracts.test.ts`
- Create: `tests/api/auth.test.ts`

**Interfaces:**
- REST/OpenAPI endpoints for evidence, observations, geospatial assets, regulatory evaluations, community graph, and public summaries.
- WebSocket messages SHALL contain typed state, evidence IDs, timestamps, and authority/validation status.

- [ ] **Step 1: Write failing OpenAPI contract tests**
- [ ] **Step 2: Run contract tests and verify missing endpoints**
- [ ] **Step 3: Implement schema-first request/response validation**
- [ ] **Step 4: Add authentication/authorization middleware and public/read-only policy boundaries**
- [ ] **Step 5: Add rate limiting, content-type validation, request-size limits, audit events, and correlation IDs**
- [ ] **Step 6: Implement realtime state publishing without allowing clients to write authoritative observations**
- [ ] **Step 7: Generate and validate OpenAPI documentation**
- [ ] **Step 8: Run API integration/security tests**
- [ ] **Step 9: Commit `feat: add governed API and realtime plane`**

### Task 8: AI Governance Plane

**Files:**
- Create: `services/ai-governance/src/model-registry.ts`
- Create: `services/ai-governance/src/evaluation.ts`
- Create: `services/ai-governance/src/lineage.ts`
- Create: `services/ai-governance/src/human-gate.ts`
- Create: `packages/schemas/src/ai.ts`
- Create: `tests/ai/governance.test.ts`

**Interfaces:**
- `registerModel(model): Promise<ModelRecord>`
- `recordEvaluation(result): Promise<ModelEvaluation>`
- `recordInference(input): Promise<InferenceRecord>`
- `requestHumanApproval(inferenceId): Promise<ApprovalRequest>`

- [ ] **Step 1: Write failing tests proving AI output cannot mutate authoritative evidence**
- [ ] **Step 2: Run tests and confirm failure**
- [ ] **Step 3: Implement model registry and model-card metadata**
- [ ] **Step 4: Implement dataset lineage, evaluation metrics, uncertainty, and inference records**
- [ ] **Step 5: Implement explicit human approval state machine for consequential outputs**
- [ ] **Step 6: Add policy tests for prohibited autonomous decisions**
- [ ] **Step 7: Run governance tests**
- [ ] **Step 8: Commit `feat: establish AI governance plane`**

### Task 9: Community Benefit and Human Needs Systems Graph

**Files:**
- Create: `services/community-benefit/src/graph.ts`
- Create: `services/community-benefit/src/benefit-score.ts`
- Create: `services/community-benefit/src/grants.ts`
- Create: `packages/schemas/src/community.ts`
- Create: `tests/community/graph.test.ts`

**Interfaces:**
- `upsertCommunityNode(node): Promise<NodeId>`
- `createCommunityEdge(edge): Promise<EdgeId>`
- `calculateBenefit(projectId): Promise<BenefitAssessment>`
- `matchFunding(projectId): Promise<FundingCandidate[]>`

- [ ] **Step 1: Write failing graph and aggregate-benefit tests**
- [ ] **Step 2: Run tests and confirm failure**
- [ ] **Step 3: Implement typed community node/edge schemas with evidence references**
- [ ] **Step 4: Implement benefit dimensions for safety, accessibility, infrastructure, environment, workforce, and economic resilience**
- [ ] **Step 5: Keep personal/sensitive information out of public aggregate nodes by design**
- [ ] **Step 6: Implement evidence-backed grant/funding matching**
- [ ] **Step 7: Run graph and benefit tests**
- [ ] **Step 8: Commit `feat: add community benefit systems graph`**

### Task 10: Replace simulated PTDT frontend state with evidence-aware APIs

**Files:**
- Modify: `tsm-console/src/App.tsx`
- Create: `tsm-console/src/api/client.ts`
- Create: `tsm-console/src/api/types.ts`
- Create: `tsm-console/src/components/EvidenceBadge.tsx`
- Create: `tsm-console/src/components/AuthorityStatus.tsx`
- Create: `tsm-console/src/components/AccessibleMapSummary.tsx`
- Create: `tsm-console/src/rendering/SceneState.ts`
- Create: `tsm-console/src/rendering/webgpu.ts`
- Create: `tsm-console/src/rendering/terrain.ts`
- Create: `tsm-console/src/rendering/water.ts`
- Create: `tests/frontend/evidence-state.test.tsx`

**Interfaces:**
- `SceneState` SHALL distinguish observed, forecast, model, simulation, and visual layers.
- Frontend API client SHALL consume typed server contracts and expose source/evidence metadata with each consequential value.

- [ ] **Step 1: Write failing tests that reject simulated telemetry being displayed as `AUTHORITATIVE`**
- [ ] **Step 2: Run frontend tests and confirm failure**
- [ ] **Step 3: Replace hard-coded sensor values with API-backed resources and explicit unavailable states**
- [ ] **Step 4: Remove random client-side evidence sealing and replace it with server-issued verification records**
- [ ] **Step 5: Move regulatory evaluation out of React conditionals into API responses**
- [ ] **Step 6: Implement evidence/status badges and provenance panels**
- [ ] **Step 7: Implement typed SceneState for MapLibre/WebGPU/3D layers**
- [ ] **Step 8: Add WebGPU capability detection and non-WebGPU fallback**
- [ ] **Step 9: Run frontend tests, build, and accessibility checks**
- [ ] **Step 10: Commit `feat: make PTDT console evidence-aware`**

### Task 11: Public accessibility layer

**Files:**
- Create: `apps/public-portal/`
- Create: `apps/public-portal/src/pages/Overview.tsx`
- Create: `apps/public-portal/src/pages/Water.tsx`
- Create: `apps/public-portal/src/pages/Floodplain.tsx`
- Create: `apps/public-portal/src/pages/Evidence.tsx`
- Create: `apps/public-portal/src/components/AccessibleDataTable.tsx`
- Create: `apps/public-portal/src/components/TextMapSummary.tsx`
- Create: `apps/public-portal/src/components/LowBandwidthMode.tsx`
- Create: `tests/accessibility/public-portal.test.tsx`

**Interfaces:**
- Public pages consume read-only API endpoints and provide textual equivalents for spatial/visual information.

- [ ] **Step 1: Write failing accessibility tests for keyboard navigation, landmark structure, labels, focus behavior, and map text alternatives**
- [ ] **Step 2: Run accessibility tests and confirm failure**
- [ ] **Step 3: Implement semantic page structure and accessible data tables**
- [ ] **Step 4: Implement text map summaries and downloadable GeoJSON/CSV/PDF references**
- [ ] **Step 5: Implement reduced-motion and low-bandwidth modes**
- [ ] **Step 6: Ensure essential information is available without WebGPU**
- [ ] **Step 7: Run automated accessibility tests and keyboard-focused browser tests**
- [ ] **Step 8: Commit `feat: add public accessibility layer`**

### Task 12: CI/CD, security, observability, and production gates

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/security.yml`
- Create: `.github/workflows/geospatial.yml`
- Create: `.github/workflows/webgpu.yml`
- Create: `.github/workflows/deploy.yml`
- Create: `infrastructure/docker/compose.yaml`
- Create: `infrastructure/terraform/`
- Create: `infrastructure/observability/otel.yaml`
- Create: `docs/operations/runbook.md`
- Create: `docs/operations/disaster-recovery.md`
- Create: `tests/acceptance/end-to-end-evidence.test.ts`

**Interfaces:**
- CI gates SHALL expose machine-readable pass/fail status for typecheck, tests, schema validation, database migrations, security scanning, geospatial validation, accessibility, and build artifacts.

- [ ] **Step 1: Write the end-to-end acceptance test**
- [ ] **Step 2: Run it locally and verify failure before the full stack exists**
- [ ] **Step 3: Implement GitHub Actions for install, typecheck, lint, unit/integration tests, and build**
- [ ] **Step 4: Add dependency, secret, container, and static security scanning**
- [ ] **Step 5: Add geospatial CRS/geometry validation and evidence manifest verification**
- [ ] **Step 6: Add WebGPU/shader validation with a supported headless browser path and a graceful capability-skipped status where hardware support is unavailable**
- [ ] **Step 7: Add OpenUSD/glTF/3D Tiles round-trip tests only for formats actually used by the implementation**
- [ ] **Step 8: Add OpenTelemetry instrumentation, structured logs, health/readiness endpoints, and operational runbooks**
- [ ] **Step 9: Implement deployment gates requiring all mandatory checks to pass**
- [ ] **Step 10: Run the complete end-to-end evidence path and security suite**
- [ ] **Step 11: Commit `ci: establish production verification and deployment gates`**

## Final verification checklist

- [ ] A real authoritative observation can be ingested and traced from source to database to object storage to API to UI.
- [ ] A failed authoritative endpoint cannot silently produce an `AUTHORITATIVE` record.
- [ ] Evidence hashes are deterministic and independently verifiable.
- [ ] Provenance can reconstruct the transformation chain.
- [ ] Forecasts and observations remain separate.
- [ ] FEMA NFHL and Indiana BAFM/FARA remain separate layers.
- [ ] Regulatory decisions reference versioned rules and evidence.
- [ ] AI outputs have lineage and human-governance state.
- [ ] Community-benefit assessments reference evidence and avoid unnecessary personal data.
- [ ] Public information remains available without WebGPU.
- [ ] Accessibility tests pass.
- [ ] Security and dependency checks pass.
- [ ] Database migrations are reproducible.
- [ ] End-to-end tests demonstrate evidence integrity.
- [ ] Production deployment is blocked by required verification failures.

## Self-review

**Spec coverage:** All approved architectural planes are represented: evidence/data governance, scientific/simulation, regulatory/governance, public experience, AI governance, community benefit/human needs graph, accessibility, APIs, operations, and CI/CD.

**Placeholder scan:** No `TBD` or `TODO` implementation placeholders are used. Each task names concrete paths, interfaces, tests, and verification actions.

**Type consistency:** Shared evidence and authority concepts are introduced before their consumers; ingestion feeds the ledger/database; regulatory evaluation consumes evidence; APIs expose those services; frontend consumes APIs; accessibility consumes public APIs; CI validates the complete chain.
