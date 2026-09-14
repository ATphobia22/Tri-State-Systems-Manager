# Integrated Live Engineering Data Fabric Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn TSM's existing evidence-first architecture into a reproducible, provenance-preserving live engineering data fabric spanning telemetry, HEC-RAS outputs, geotechnical calculations, no-rise analysis, authoritative BFE evidence, observability, WebSockets, security, and automated verification.

**Architecture:** Preserve the existing source/evidence hierarchy and add a canonical versioned telemetry contract shared by ingestion, APIs, WebSockets, metrics, and the Open-World Twin. Separate observations, forecasts, derived engineering results, simulation/rendering state, and regulatory evidence; store provenance and hashes with derived products; fail closed when required datum, survey, model, material, or authority evidence is missing. HEC-RAS and Bishop calculations remain deterministic evidence-producing modules, while regulatory conclusions remain human/agency review states.

**Tech Stack:** Python 3.x + Pydantic 2.x for backend contracts and calculations, async HTTP client already used or approved by the repository, h5py for HEC-RAS HDF5 inspection, Prometheus exposition, Node.js 22+/TypeScript/React 19/Vite for the console, WebSocket API already present in TSM, GitHub Actions, and existing repository test infrastructure.

**Spec:** `docs/superpowers/specs/2026-09-14-community-river-valley-engineering-twin-design.md`

## Global Constraints

- Primary-source government products are preferred and provenance must travel with every derived/rendered dataset.
- Raw gage height remains in source datum; NAVD88 WSE is derived only with validated conversion metadata.
- Observed telemetry cadence, state-estimation cadence, simulation timestep, and rendering cadence are separate concepts and must never be conflated.
- No synthetic production geospatial or telemetry data may be represented as real-world observation.
- HEC-RAS output is accepted only when the actual model artifact, plan/version metadata, dataset path, units, timestep, and scenario identity are verified.
- Bishop FoS is an engineering calculation, not a universal legal threshold; acceptance criteria must be explicitly sourced per load case/design basis.
- No-rise is computed from matched base/proposed model results under documented equivalent conditions; a heuristic cannot substitute for the hydraulic comparison.
- Regulatory BFE, derived model WSE, and visualization elevation are distinct evidence types.
- Alerting endpoints and telemetry channels must not expose credentials, secrets, private addresses, or uncontrolled high-cardinality labels.
- New behavior requires automated contract tests and full CI verification before being called complete.

---

### Task 1: Canonical telemetry contract and provenance envelope

**Files:**
- Inspect/modify: `backend/api/v1/schemas.py`
- Create: `backend/api/v1/telemetry_contracts.py`
- Create: `data/schemas/telemetry.schema.json`
- Create: `artifacts/tsm-telemetry-contract-v1.json`
- Test: `backend/tests/test_telemetry_contract.py`

**Interfaces:**
- `TelemetryObservation` with `schema_version`, `source`, `station_id`, `parameter_code`, `observed_at`, `received_at`, `value`, `unit`, `source_datum`, `quality_status`, `approval_status`, `source_uri`, `upstream_record_id`, `payload_sha256`, and `provenance_class`.
- `TelemetryEnvelope` with observation identity, source metadata, freshness state, and optional derived values; derived values must reference the source observation IDs.
- Explicit timestamp semantics: observation time is when the source says the measurement occurred; receipt time is when TSM received it.

- [ ] Step 1: Write failing tests rejecting missing station/source/time/unit/provenance fields and rejecting `NAVD88` as the raw datum for an unconverted gage-height observation.
- [ ] Step 2: Run `pytest backend/tests/test_telemetry_contract.py -v` and verify failure.
- [ ] Step 3: Implement strict Pydantic models and JSON Schema with `extra="forbid"` and constrained enums.
- [ ] Step 4: Add deterministic serialization and SHA-256 payload identity helpers.
- [ ] Step 5: Run focused tests and existing backend schema tests.
- [ ] Step 6: Commit `feat: establish canonical telemetry contract`.

### Task 2: Actual asynchronous USGS/NWPS ingestion

**Files:**
- Inspect: existing river-network ingestion modules and source registry.
- Create/modify: `backend/ingestion/usgs_async.py` and `backend/ingestion/nwps_async.py` or the repository's established equivalent.
- Create: `backend/ingestion/source_state.py`
- Test: `backend/tests/test_live_ingestion.py`
- Modify: `backend/requirements.txt` only if an async dependency is not already available.

**Interfaces:**
- `async def fetch_usgs_observations(station_ids: Sequence[str], since: datetime | None) -> list[TelemetryObservation]`
- `async def fetch_nwps_observations(station_ids: Sequence[str], since: datetime | None) -> list[TelemetryObservation]`
- `SourceState` tracks last success, last failure, latency, freshness, HTTP status, retry count, and circuit state.

- [ ] Step 1: Write transport-mocked tests for successful retrieval, timeout, retry/backoff, HTTP error, malformed payload, provisional status, and stale-source state.
- [ ] Step 2: Run focused tests and verify they fail.
- [ ] Step 3: Implement bounded async HTTP sessions with explicit connect/read/write/pool timeouts, retry only for retryable failures, exponential backoff with jitter, and bounded concurrency.
- [ ] Step 4: Parse authoritative source timestamps and quality/approval fields without rewriting them as current time.
- [ ] Step 5: Store payload hashes and source URIs; preserve raw source datum separately from derived NAVD88 conversions.
- [ ] Step 6: Add a migration-ready USGS adapter boundary so the legacy Water Services endpoint can be replaced by the current Water Data API without changing downstream contracts.
- [ ] Step 7: Run focused tests plus the existing river/reliability suites.
- [ ] Step 8: Commit `feat: add asynchronous authoritative hydrology ingestion`.

### Task 3: Prometheus exporter and operational metrics

**Files:**
- Create/modify: `backend/api/v1/metrics.py` or existing metrics module.
- Create: `backend/api/v1/prometheus.py` only if required by current architecture.
- Test: `backend/tests/test_prometheus_metrics.py`
- Modify: deployment/Prometheus configuration only after inspecting its current structure.

**Interfaces:**
- `GET /metrics` emits valid Prometheus exposition text.
- Metrics include bounded-cardinality source health, ingestion latency, successful/failed retrieval counters, observation freshness gauges, WebSocket connection counts, calculation durations, and HEC-RAS artifact-processing failures.

- [ ] Step 1: Write parser-level tests for valid HELP/TYPE/sample records and bounded labels.
- [ ] Step 2: Run focused tests and verify failure.
- [ ] Step 3: Implement exporter output without embedding metric samples inside `prometheus.yml`.
- [ ] Step 4: Ensure station IDs are not unbounded labels unless explicitly approved; aggregate high-cardinality diagnostics into logs/evidence instead.
- [ ] Step 5: Validate configuration with `promtool check config` and rules with `promtool check rules` when Prometheus tooling is available.
- [ ] Step 6: Commit `feat: add Prometheus operational telemetry`.

### Task 4: Versioned WebSocket routing and backpressure

**Files:**
- Inspect existing WebSocket server/router.
- Create/modify: existing WebSocket route module.
- Create/modify: `tsm-console/src/lib/telemetry-websocket.ts`.
- Test: backend WebSocket contract tests and `tsm-console/tests/telemetry-websocket.test.mjs`.

**Interfaces:**
- Versioned envelope: `{type, schema_version, stream_id, sequence, observed_at, emitted_at, payload, provenance}`.
- Server route must authenticate/authorize according to the repository's security model, validate outbound payloads against the canonical contract, heartbeat, bound per-client queues, and disconnect slow consumers deterministically.

- [ ] Step 1: Write failing tests for correct route selection, invalid envelope rejection, sequence monotonicity, heartbeat, stale stream state, and slow-client backpressure.
- [ ] Step 2: Run focused tests and verify failure.
- [ ] Step 3: Implement one canonical router-to-stream mapping rather than parallel ad-hoc routes.
- [ ] Step 4: Implement bounded queues and explicit close codes/reconnect guidance.
- [ ] Step 5: Bind the console client to the versioned contract and separate observed/forecast/model messages.
- [ ] Step 6: Run focused tests and frontend type checks.
- [ ] Step 7: Commit `feat: standardize live telemetry WebSocket fabric`.

### Task 5: Dynamic HEC-RAS HDF5 discovery and validated extraction

**Files:**
- Modify: `backend/api/v1/hecras_solver.py` only where integration requires it.
- Create: `backend/api/v1/hecras_hdf5.py`
- Create: `backend/api/v1/hecras_artifact.py`
- Test: `backend/tests/test_hecras_hdf5.py`
- Test fixture: `backend/tests/fixtures/hecras/` with minimal synthetic HDF5 structure clearly labeled as test fixture.

**Interfaces:**
- `discover_2d_water_surface_paths(hdf_path: Path) -> list[HecRasDatasetRef]`
- `read_water_surface_series(hdf_path: Path, dataset_ref: HecRasDatasetRef) -> HecRasWaterSurfaceSeries`
- `HecRasDatasetRef` carries scenario/plan identity, area name, dataset path, dimensions, units, timestamps, and artifact hash.

- [ ] Step 1: Write fixtures containing the documented HEC-RAS 2D water-surface hierarchy plus a negative fixture with a changed area name.
- [ ] Step 2: Write failing tests proving the implementation discovers the actual `2D Flow Areas/<area>/Water Surface` dataset rather than hard-coding one area name.
- [ ] Step 3: Run focused tests and verify failure.
- [ ] Step 4: Implement recursive candidate discovery with explicit validation of dimensions, numeric type, time indexing, and required metadata.
- [ ] Step 5: Reject missing/ambiguous water-surface datasets with actionable diagnostics instead of silently selecting an incorrect dataset.
- [ ] Step 6: Record source artifact SHA-256, plan file identity, extraction time, software version, and dataset path in evidence metadata.
- [ ] Step 7: Run focused tests and existing HEC-RAS tests.
- [ ] Step 8: Commit `feat: validate dynamic HEC-RAS water-surface extraction`.

### Task 6: Reproducible Bishop factor-of-safety engine

**Files:**
- Create: `backend/api/v1/bishop.py`
- Create: `backend/api/v1/bishop_provenance.py`
- Test: `backend/tests/test_bishop.py`
- Test: `backend/tests/test_bishop_provenance.py`

**Interfaces:**
- `calculate_bishop_fos(problem: BishopProblem, settings: BishopSettings) -> BishopResult`
- Inputs include slice geometry, material unit weight, effective cohesion, friction angle, pore pressure, water forces, surcharge/load case, slice count, convergence tolerance, maximum iterations, and method version.
- Result includes FoS, convergence state, iteration count, controlling assumptions, input hash, method identifier, settings hash, and provenance references.

- [ ] Step 1: Write deterministic regression tests against hand-checkable/reference cases, including a non-convergent case.
- [ ] Step 2: Run focused tests and verify failure.
- [ ] Step 3: Implement the ordinary method of slices/modified Bishop formulation selected by the design basis, with explicit units and radians/degrees handling.
- [ ] Step 4: Implement deterministic convergence criteria and reject NaN/infinite/intermediate invalid states.
- [ ] Step 5: Serialize the full calculation provenance and hash the canonical input/settings representation.
- [ ] Step 6: Add explicit acceptance-criteria metadata rather than hard-coding a universal FoS threshold.
- [ ] Step 7: Run focused tests and backend static/type checks.
- [ ] Step 8: Commit `feat: add reproducible Bishop stability calculation`.

### Task 7: Actual base-vs-proposed HEC-RAS no-rise computation

**Files:**
- Create: `backend/api/v1/no_rise.py`
- Create: `data/schemas/no-rise.schema.json`
- Test: `backend/tests/test_no_rise.py`
- Modify: existing HEC-RAS evidence modules only where shared artifact types are needed.

**Interfaces:**
- `compare_base_proposed_wse(base: HecRasWaterSurfaceSeries, proposed: HecRasWaterSurfaceSeries, alignment: NoRiseAlignment) -> NoRiseResult`
- Result contains matched scenario identity, spatial/temporal alignment evidence, delta WSE statistics, maximum positive increase, location/index of maximum increase, exceedance status against an explicitly supplied criterion, and unresolved-data flags.

- [ ] Step 1: Write tests for identical models (zero rise), known positive rise, known negative change, mismatched timestamps, mismatched geometry/grid, and missing cells.
- [ ] Step 2: Run focused tests and verify failure.
- [ ] Step 3: Implement strict compatibility validation before arithmetic.
- [ ] Step 4: Align equivalent time steps/events and calculate `proposed_wse - base_wse` using the same spatial reference and units.
- [ ] Step 5: Report maximum positive increase, distribution statistics, and spatial evidence; do not convert a heuristic into a no-rise conclusion.
- [ ] Step 6: Require an explicit jurisdiction/design-basis threshold and label the result `MODEL_COMPARISON_ONLY` until human review records an engineering/regulatory state.
- [ ] Step 7: Run focused tests and hydraulic evidence tests.
- [ ] Step 8: Commit `feat: add base-proposed hydraulic no-rise comparison`.

### Task 8: Authoritative BFE provenance contract

**Files:**
- Create: `data/schemas/bfe-provenance.schema.json`
- Create: `backend/api/v1/bfe_provenance.py`
- Create/modify: existing FEMA/Indiana floodplain source registry.
- Test: `backend/tests/test_bfe_provenance.py`

**Interfaces:**
- `BfeEvidence` records source agency, product/service ID, panel/map identifier, effective date, feature/object ID when available, retrieval time, source URI, horizontal CRS, vertical datum, value/unit, source status, payload/feature hash, and provenance class.

- [ ] Step 1: Write tests proving FEMA effective BFE and Indiana BAFM evidence cannot be silently merged into one authoritative field.
- [ ] Step 2: Run focused tests and verify failure.
- [ ] Step 3: Implement strict source-specific evidence types and explicit reconciliation state.
- [ ] Step 4: Reject BFE values missing vertical datum or source identity.
- [ ] Step 5: Add evidence hashes and retrieval timestamps.
- [ ] Step 6: Bind the Open-World Twin to the provenance object so displayed elevations identify whether they are regulatory BFE, observed/derived WSE, or visualization-only values.
- [ ] Step 7: Run focused tests and existing FIRM/geospatial tests.
- [ ] Step 8: Commit `feat: establish authoritative BFE provenance`.

### Task 9: Secure Alertmanager integration

**Files:**
- Inspect current deployment/observability files.
- Modify: Alertmanager configuration and reverse-proxy configuration using existing repository conventions.
- Create: `scripts/validate-alerting-config.py` if no equivalent exists.
- Test: configuration/security contract tests.

**Interfaces:**
- Alert delivery remains internal or authenticated; no unauthenticated public Alertmanager endpoint.
- Credentials are supplied through environment/secret mounts, never committed.

- [ ] Step 1: Write tests/checks rejecting cleartext credentials in tracked configuration and unauthenticated external exposure.
- [ ] Step 2: Inspect the current Alertmanager version and supported authentication mechanism before selecting the configuration format.
- [ ] Step 3: Implement TLS/authentication or a hardened internal-only reverse-proxy boundary using the supported mechanism.
- [ ] Step 4: Validate routing and config with the exact installed Alertmanager version.
- [ ] Step 5: Run security/configuration tests and CI.
- [ ] Step 6: Commit `security: harden Alertmanager access`.

### Task 10: Automated build/type/test/config verification gate

**Files:**
- Modify: `.github/workflows/ci.yml` and relevant specialized workflows after inspection.
- Create/modify: `scripts/verify-all.py` or repository-equivalent orchestrator.
- Create/modify: contract test suites for telemetry, HEC-RAS, no-rise, BFE, WebSocket, metrics, and provenance.

**Interfaces:**
- One deterministic verification command runs parse/import checks, Python tests/type checks, frontend TypeScript/build checks, schema validation, Prometheus config/rules validation, WebSocket contracts, HEC-RAS fixture tests, no-rise/Bishop regression tests, and security scans available in the repository.

- [ ] Step 1: Inventory existing CI commands and preserve every valid gate.
- [ ] Step 2: Add failing CI assertions for missing schema, type, HEC-RAS, metrics, and provenance coverage.
- [ ] Step 3: Implement the smallest deterministic verification orchestrator; fail fast on malformed configuration but report all independent test groups where practical.
- [ ] Step 4: Run the full local verification suite and record exact outputs.
- [ ] Step 5: Run GitHub Actions on the implementation branch and inspect actual workflow results.
- [ ] Step 6: Fix only verified failures using root-cause investigation.
- [ ] Step 7: Re-run the complete suite and verify a clean result before claiming completion.
- [ ] Step 8: Commit `ci: enforce integrated engineering data fabric verification`.

### Task 11: Open-World Twin integration and evidence-aware presentation

**Files:**
- Modify: `tsm-console/src/components/RealWorldTwinMap.tsx`
- Modify/create: `tsm-console/src/lib/telemetry-websocket.ts`
- Modify: `tsm-console/src/lib/hec-ras-contracts.ts`
- Modify: `tsm-console/src/lib/gage-datums.ts`
- Modify: existing tile/source resolvers from the 2026-09-14 live geospatial plan.
- Test: twin, telemetry, tile and evidence contract suites.

**Interfaces:**
- Visual layers consume typed source/evidence objects and display freshness/provenance state.
- Rendered depth/WSE/terrain products are never exposed as if they were raw observations.

- [ ] Step 1: Write failing UI/data-contract tests for observed, forecast, derived, model-output, stale, unavailable, and simulation states.
- [ ] Step 2: Implement the minimum adapter changes required to consume the canonical backend envelopes.
- [ ] Step 3: Ensure visualization transformations do not mutate engineering source values.
- [ ] Step 4: Add source/evidence indicators to engineering-mode views.
- [ ] Step 5: Run focused twin and frontend tests.
- [ ] Step 6: Commit `feat: integrate evidence-aware live engineering state into twin`.

### Task 12: Final verification, documentation, and release evidence

**Files:**
- Modify: `README.md`
- Modify: `docs/REAL-TIME-DATA-OPERATIONS.md`
- Modify: `docs/OPEN-WORLD-3D-TWIN-AND-HECRAS-MESH-v1.0.md`
- Modify: `docs/DEPLOYMENT-AND-OPERATIONS.md` where present.
- Create: `artifacts/tsm-engineering-data-fabric-verification-v1.json`

- [ ] Step 1: Run all focused suites and the full verification command.
- [ ] Step 2: Verify the repository contains no production fake telemetry, hard-coded private property identifiers, embedded credentials, or unvalidated engineering conclusions.
- [ ] Step 3: Verify current-source claims against authoritative source metadata at release time.
- [ ] Step 4: Record software versions, schema versions, test results, source hashes, and known limitations in the release evidence artifact.
- [ ] Step 5: Update documentation only to describe behavior demonstrated by tests/runtime evidence.
- [ ] Step 6: Run final CI and inspect workflow output.
- [ ] Step 7: Commit `docs: finalize integrated engineering data fabric verification`.

## Verification Matrix

| Domain | Required evidence |
|---|---|
| Telemetry | Versioned schema, source timestamps, units, datum, quality, hashes, freshness |
| USGS/NWPS | Actual async retrieval with bounded retries/timeouts and source-state tracking |
| Prometheus | Valid exposition and validated configuration/rules |
| WebSocket | Versioned routing, schema validation, heartbeat, bounded backpressure |
| HEC-RAS | Dynamic HDF5 dataset discovery, validated dimensions/metadata, artifact hash |
| Bishop | Deterministic calculation, convergence evidence, complete provenance |
| No-rise | Matched base/proposed model comparison with explicit criterion and evidence |
| BFE | Source/product/panel/effective-date/datum/object provenance |
| Alerting | Authenticated or internal-only endpoint; no committed secrets |
| CI | Type/build/test/schema/config/security gates with actual passing evidence |
| Open World Twin | Source-aware rendering with observed/forecast/model/simulation separation |
| Governance | Privacy, human review, regulatory non-automation and public-safety boundaries |
