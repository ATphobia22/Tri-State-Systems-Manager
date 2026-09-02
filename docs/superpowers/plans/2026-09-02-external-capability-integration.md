# External Capability Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the seven approved external repositories as governed capability sources on `main`, consolidate CI truth, and add fail-closed validation without vendoring third-party code.

**Architecture:** TSM remains the canonical system of record. External repositories are represented by immutable provenance records and consumed only through explicit capability boundaries: CI/infrastructure patterns, geospatial/3D asset tooling, and isolated quantum research. The canonical CI gate remains GitHub Actions on hosted runners; specialized workloads are opt-in and platform-bound.

**Tech Stack:** GitHub Actions, Node.js 22, npm lockfile, Bash, JSON Schema, Node test runner, CityEngine/Unreal adapters, Docker service contracts, quantum adapter contracts.

**Spec:** `docs/superpowers/specs/2026-09-02-external-capability-integration-design.md`

## Global Constraints

- GitHub-hosted runners remain the default CI execution environment.
- CityEngine/Unreal processing is optional and requires a dedicated Windows environment with licensed Esri software.
- Quantum capabilities are isolated, opt-in, and cannot mutate authoritative regulatory/evidence state.
- No complete external repository is vendored into TSM.
- Authoritative geospatial data and CRS/vertical-datum truth remain owned by TSM.
- Third-party shell content is curated and never executed directly from a fetched repository.
- Dependencies, actions, capability references, and generated artifacts require provenance.
- Existing TSM tests and build contracts remain mandatory.

### Task 1: Capability registry and machine-readable contracts

**Files:**
- Create: `integrations/registry/capabilities.json`
- Create: `integrations/registry/capability.schema.json`
- Create: `integrations/README.md`
- Create: `integrations/cityengine/README.md`
- Create: `integrations/quantum/README.md`

- [ ] Define all seven repositories, exact immutable references, classification, license/provenance, runtime boundary, and validation contract.
- [ ] Validate registry JSON against its schema.
- [ ] Document licensing restrictions for Esri SDK/plugin and the archived OpenFermion-Cirq source.

### Task 2: Repository and security validation tooling

**Files:**
- Create: `scripts/ci/validate-capability-registry.mjs`
- Create: `scripts/ci/validate-workflow-boundaries.mjs`
- Create: `scripts/ci/validate-shell-safety.sh`
- Create: `scripts/ci/validate-artifact-manifests.mjs`
- Create: `scripts/ci/validate-quantum-boundary.mjs`
- Create: `tests/external-capability-integration.test.mjs`

- [ ] Add fail-closed registry validation.
- [ ] Reject mutable refs such as branch names in capability records.
- [ ] Reject unsafe workflow patterns and unrestricted third-party script execution.
- [ ] Validate 3D asset manifests for CRS, vertical datum, provenance, hash, and format.
- [ ] Validate quantum contracts cannot declare authoritative/regulatory mutation.
- [ ] Test every validator with positive and negative cases.

### Task 3: Canonical CI consolidation

**Files:**
- Modify: `.github/workflows/ci.yml`
- Delete: `.github/workflows/tsm-console-ci.yml`
- Create: `.github/workflows/infrastructure-ci.yml`
- Create: `.github/workflows/geospatial-ci.yml`
- Create: `.github/workflows/container-ci.yml`
- Create: `.github/workflows/quantum-ci.yml`

- [ ] Make `ci.yml` the only canonical application gate.
- [ ] Add registry/security/artifact validation before build and tests.
- [ ] Add independently dispatchable specialized workflows with strict boundaries.
- [ ] Keep heavy Windows/Unreal processing opt-in and unavailable on ordinary hosted Linux runners.
- [ ] Keep quantum workflow opt-in and non-authoritative.

### Task 4: Capability contracts and provenance artifacts

**Files:**
- Create: `integrations/cityengine/asset-manifest.schema.json`
- Create: `integrations/geospatial/3d-asset-contract.schema.json`
- Create: `integrations/quantum/optimization-contract.schema.json`
- Create: `integrations/registry/README.md`

- [ ] Establish machine-readable boundaries consumed by CI and future adapters.
- [ ] Ensure every generated 3D artifact records source CRS, target CRS, vertical datum, toolchain, source reference, and SHA-256.
- [ ] Ensure quantum outputs are explicitly research-only and deterministic-testable.

### Task 5: Verification and main-branch publication

- [ ] Run all available repository-level static validation through GitHub Actions.
- [ ] Inspect workflow results and logs for failures.
- [ ] Compare final `main` tree against the approved specification.
- [ ] Remove the temporary feature branch if the available GitHub integration permits branch deletion.
- [ ] Report any limitation instead of claiming unverified completion.
