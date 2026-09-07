# Reliability and Real-Time Data Fabric Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Make TSM reproducible, observable, fail-closed, and explicit about live-source freshness and software/data provenance.

**Architecture:** Extend the existing bounded HTTP/source-health layer with deterministic retry classification, retry-after support, per-source circuit breakers, and freshness evaluation. Add CI supply-chain gates for exact npm reproducibility, audit/signatures, SBOM generation, npx policy, and machine-readable build provenance; expose operational health through the existing Node API.

**Tech Stack:** Node.js 22, exact npm 10.9.2, npm lockfile, GitHub Actions, Node test runner, existing ESM ingestion modules.

**Spec:** `docs/superpowers/specs/2026-09-07-reliability-data-fabric-design.md`

## Global Constraints
- `npm ci` is the only CI dependency installation path.
- Node remains `>=22` and CI uses Node `22`.
- CI pins npm to `10.9.2`, matching `packageManager`.
- No automatic dependency upgrades or `npm audit fix`.
- No browser-direct authoritative-source calls.
- No production mock fallback.
- Source datum/CRS is preserved; no silent NAVD88 conversion.
- Last-known-good data is never labeled LIVE.
- No regulatory determination or permit filing automation.
- Final CI must run against one stable `main` SHA.

### Task 1: Reliability primitives
**Files:** Create `tsm-console/server/reliability/circuit-breaker.mjs`, `freshness.mjs`, `retry-policy.mjs`; Test `tsm-console/tests/reliability-primitives.test.mjs`.
- [ ] Write failing tests for closed/open/half-open circuit transitions, retryable statuses, Retry-After seconds/date parsing, and fresh/stale classification.
- [ ] Implement deterministic bounded primitives with injectable clock/sleep.
- [ ] Run `node --test tests/reliability-primitives.test.mjs`.
- [ ] Commit `feat: add deterministic reliability primitives`.

### Task 2: Upgrade source health
**Files:** Modify `tsm-console/server/ingestion/source-health.mjs`; Test `tsm-console/tests/source-health.test.mjs`.
- [ ] Write tests for latency, success/error counts, circuit state, and immutable returned snapshots.
- [ ] Add per-source latency and circuit fields while preserving existing exports.
- [ ] Run the focused test suite.
- [ ] Commit `feat: enrich source health telemetry`.

### Task 3: Integrate reliability into HTTP client
**Files:** Modify `tsm-console/server/ingestion/http-client.mjs`; Test `tsm-console/server/ingestion/http-client.test.mjs`.
- [ ] Add failing tests for 429/5xx retry, 4xx fail-fast, Retry-After, timeout, max-byte rejection, and circuit-open short-circuit.
- [ ] Implement bounded retry policy and circuit integration without changing adapter response contracts.
- [ ] Run focused HTTP tests and existing ingestion tests.
- [ ] Commit `feat: harden upstream HTTP reliability`.

### Task 4: Add source-specific freshness policy
**Files:** Create `tsm-console/server/reliability/source-policies.mjs`; modify `tsm-console/server/ingestion/workers.mjs`; Test `tsm-console/tests/source-freshness.test.mjs`.
- [ ] Define explicit configurable classes for hydrologic observations, forecasts, static regulatory GIS, and elevation/imagery products.
- [ ] Evaluate freshness from observation/retrieval timestamps and preserve `freshness_state` separately from transport health.
- [ ] Ensure stale data cannot be emitted as `LIVE`.
- [ ] Run focused and ingestion tests.
- [ ] Commit `feat: enforce source freshness semantics`.

### Task 5: API operational health
**Files:** Modify `tsm-console/server/token-proxy.mjs`; Test `tsm-console/tests/api-health.test.mjs`.
- [ ] Test `/health`, `/ready`, and `/api/data-sources/health` response contracts.
- [ ] Add stable health/readiness responses including process, source, and build identity without secrets.
- [ ] Keep upstream source failure distinct from internal readiness failure.
- [ ] Run focused tests.
- [ ] Commit `feat: expose reliability health endpoints`.

### Task 6: Dependency integrity policy
**Files:** Create `tsm-console/scripts/dependency-integrity.mjs`, `tsm-console/scripts/npx-policy-check.mjs`; modify `tsm-console/package.json`; Test `tsm-console/tests/dependency-integrity.test.mjs`.
- [ ] Test exact package-manager metadata, lockfile presence, prohibited install flags, and unpinned remote npx detection.
- [ ] Implement checks that fail closed on drift or unsafe CI patterns.
- [ ] Add scripts `check:dependency-integrity` and `check:npx-policy`.
- [ ] Run focused tests.
- [ ] Commit `feat: enforce npm supply-chain policy`.

### Task 7: SBOM and provenance manifest
**Files:** Create `tsm-console/scripts/generate-sbom.mjs`; modify CI; Test `tsm-console/tests/sbom-manifest.test.mjs`.
- [ ] Add deterministic SBOM invocation using the committed lockfile and a machine-readable manifest bound to `GITHUB_SHA`.
- [ ] Validate artifact paths and required identity fields.
- [ ] Do not commit generated SBOM output into source.
- [ ] Run local script with a synthetic CI identity and validate output.
- [ ] Commit `feat: add software provenance artifacts`.

### Task 8: CI supply-chain gates
**Files:** Modify `.github/workflows/ci.yml`; Create `.github/workflows/reliability-maintenance.yml`.
- [ ] Pin npm 10.9.2 before install and assert `node --version`/`npm --version`.
- [ ] Keep `npm ci --no-audit --no-fund`, then run dependency integrity, audit, signatures, SBOM, npx policy, and build provenance checks as separate steps.
- [ ] Add scheduled `npm doctor` and `npm cache verify` maintenance diagnostics without treating cache as evidence storage.
- [ ] Upload SBOM/provenance artifacts.
- [ ] Validate workflow syntax and run repository workflow gates.
- [ ] Commit `ci: enforce reproducible supply-chain gates`.

### Task 9: Documentation and operator contract
**Files:** Create `docs/RELIABILITY-AND-DATA-FABRIC-OPERATIONS.md`; modify README/quickstart if required.
- [ ] Document live/delayed/stale semantics, source health, circuit behavior, npm controls, operational maintenance, and failure modes.
- [ ] Document that `ATphobia22/npm` is archived and is not a runtime dependency.
- [ ] Add operator commands and expected failure semantics.
- [ ] Run docs consistency checks.
- [ ] Commit `docs: document reliability operations`.

### Task 10: Full verification and stable-main CI
**Files:** No new files; verify all modified paths.
- [ ] Run all focused reliability/dependency tests.
- [ ] Run `npm run ci:full` against the final checkout.
- [ ] Push/verify one stable `main` SHA and inspect the corresponding GitHub Actions run.
- [ ] If a failure is genuine, fix it with a focused change and repeat verification; do not paper over failures.
- [ ] Confirm no mock production path, no secret material, no unpinned remote execution, and no silent datum conversion was introduced.
- [ ] Record the final commit SHA and CI result in the completion report.
