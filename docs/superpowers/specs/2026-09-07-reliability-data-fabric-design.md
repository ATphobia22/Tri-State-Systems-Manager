# Reliability and Real-Time Data Fabric Design

**Date:** 2026-09-07  
**Status:** Approved for implementation on `main`

## Goal
Make TSM reproducible, observable, fail-closed, and explicit about the difference between live authoritative observations, delayed/last-known-good data, derived engineering results, and software supply-chain state.

## Architecture
The system uses one reliability boundary around the existing source-adapter/evidence architecture. npm supply-chain controls are enforced in CI and produce immutable build evidence; runtime source reliability is tracked independently per provider/endpoint and feeds explicit health/freshness state to the API and UI. Software provenance and data provenance remain separate chains and are joined only by the Git commit/build/runtime identity that produced or served an artifact.

## Core requirements
1. `npm ci` is the only CI dependency installation path; the committed lockfile and exact npm CLI version are validated before build/test.
2. Dependency security is explicit: run audit, signature verification, and SBOM generation as separate CI gates/artifacts. Do not mutate dependencies with `npm audit fix` in CI.
3. TSM must not depend on the archived `ATphobia22/npm` repository as runtime code; current npm CLI documentation and upstream npm CLI are the references.
4. Remote `npx` execution is prohibited in CI unless the command is explicitly version-pinned and reviewed; repository scripts should prefer local package binaries.
5. Runtime source failures use bounded retry/backoff, retry-after handling, and per-source circuit breakers. A circuit-open source is not retried until cooldown expires.
6. Source health records include success/error counts, latency, last success/error, state, and circuit state. Health is in-memory and operational; evidence records remain immutable and separately stored.
7. Freshness is source-specific and configuration-driven. No source is labeled LIVE merely because a request succeeded. Last-known-good data is labeled delayed/stale and retains its original observation timestamp.
8. Hydrologic observations preserve source datum/CRS and must not silently become NAVD88. Existing validated datum conversion rules remain authoritative.
9. API exposes `/health`, `/ready`, and `/api/data-sources/health`; readiness fails when required internal invariants are unavailable, while source outages are represented explicitly rather than hidden.
10. CI emits a CycloneDX or SPDX SBOM and a machine-readable reliability manifest bound to `${GITHUB_SHA}`.
11. Cache verification is an operational maintenance check; npm cache is never treated as a persistent evidence store.
12. npm trusted publishing is documented for future package publication, but no publishing workflow is added because TSM is currently private application code.
13. No production mock-data fallback is introduced.
14. No automatic FEMA/IDNR regulatory determination or permit filing is introduced.

## Runtime data flow
```text
USGS / NOAA / FEMA / IDNR / USACE / 3DEP
        -> bounded HTTP client
        -> source adapter
        -> normalization + datum/CRS validation
        -> source health + circuit breaker + freshness evaluation
        -> evidence store / cache
        -> TSM API
        -> React / MapLibre
```

## Reliability state model
`healthy` means a recent successful source interaction; `degraded` means recent failures but the source is still callable; `circuit_open` means repeated failures have crossed the configured threshold; `unknown` means no observation has been recorded. Freshness is orthogonal: a healthy endpoint can still return an old observation and therefore be `stale`.

## Security and supply chain
CI pins Node major and exact npm CLI version, uses the public npm registry, installs from the lockfile, verifies the dependency tree, runs `npm audit --audit-level=high`, runs `npm audit signatures` without turning missing attestations into an undocumented hard failure, generates an SBOM, and checks repository workflows for unpinned remote `npx` use. Installation scripts are inventoried by the lockfile/package metadata; no blanket allow-all script flag is permitted.

## Testing
Reliability modules receive deterministic Node test coverage for circuit transitions, retry classification, retry-after parsing, freshness classification, source-health aggregation, and dependency policy checks. Existing ingestion, geospatial, evidence, parse, type, and build gates remain required. CI is run only after all changes are on a stable `main` SHA to avoid the previously observed exact-main race.

## Non-goals
- No replacement of the existing evidence store with a new database in this increment.
- No Prometheus dependency solely for this increment.
- No automatic dependency upgrades.
- No browser-direct calls to authoritative providers.
- No regulatory automation.
