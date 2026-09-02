# Tri-State Systems Manager External Capability Integration Design

**Date:** 2026-09-02  
**Status:** Approved architecture; implementation follows on the isolated integration branch  
**Target:** `ATphobia22/Tri-State-Systems-Manager`  

## 1. Goal

Integrate seven external repositories as governed capability sources rather than copying their repositories into TSM. The integration must preserve TSM as the canonical system of record while adding reusable CI, container, geospatial/digital-twin, CityEngine/Unreal, and isolated quantum capability boundaries.

## 2. Current Baseline

The target repository uses GitHub Actions with a primary `.github/workflows/ci.yml` that checks out the repository, installs Node 22 dependencies from the public npm registry, verifies the main commit binding, runs repository-integrity and geospatial-contract gates, parses, typechecks, builds, tests, and uploads the production artifact. A second `.github/workflows/tsm-console-ci.yml` duplicates substantial dependency, parse, typecheck, build, test, and artifact behavior. Consolidation is therefore a first-class objective, not an afterthought.

The existing console package defines explicit scripts for integrity, geospatial validation, parse, TypeScript typechecking, build, complete tests, cinematic tests, raster validation, and CI/CI-full execution. TSM therefore has established contracts that should be extended rather than replaced.

The engineering source material also establishes a separation between authoritative regulatory data, computational physical solvers, and cinematic visualization. Visualization consumes engineering outputs and must not become the regulatory source of truth. The broader engineering documentation specifies GitHub/Replit/Vercel delivery, PostGIS-backed engineering data, WebGPU/Three.js/MapLibre visualization, deterministic calculations, provenance, audit trails, and CI/CD verification as distinct architectural concerns.

## 3. Capability Sources

| Source repository | TSM role | Integration mode | Boundary |
|---|---|---|---|
| `jonashackt/gitlab-ci-stack` | Self-hosted infrastructure reference | Documentation/pattern extraction; optional Ansible/Docker/Vagrant profiles | Never required for normal GitHub-hosted CI |
| `marcelbirkner/docker-ci-tool-stack` | Containerized CI/service-test reference | Selective test-harness patterns only | Explicitly treated as a workshop/demo reference, not production infrastructure |
| `HariSekhon/DevOps-Bash-tools` | Operational shell validation reference | Curated scripts/patterns after license/security review | No uncontrolled third-party shell execution |
| `Esri/cityengine_for_unreal` | CityEngine procedural-asset / UE5 capability | Isolated optional Unreal workspace and asset contract | License/platform gate; never a web-runtime dependency |
| `Esri/cityengine-sdk` | Procedural geometry generation interface | Optional build worker / SDK adapter | License/platform/toolchain gate; binaries are not copied into TSM source |
| `3d-geospatial/3d-geospatial.com` | 3D geospatial engineering reference | Standards and implementation-pattern reference | No content copying without rights; repository states its content is all rights reserved unless separately licensed |
| `quantumlib/OpenFermion-Cirq` | Quantum research/optimization reference | Isolated research capability and contract tests | Repository is archived; never a production geospatial-CI prerequisite |

The reconnaissance confirmed these public repositories by exact repository identity. `OpenFermion-Cirq` is archived, which strengthens the quarantine requirement. The CityEngine sources explicitly impose licensing and platform constraints. The 3D-geospatial repository describes itself as a reference library and states that its content is all rights reserved unless a `LICENSE` file says otherwise. The Docker CI stack explicitly states that it is not production ready. These facts are treated as integration constraints, not silently normalized away.

## 4. Architecture

```text
                           TSM CANONICAL REPOSITORY
                                      |
                         capability registry + contracts
                                      |
        +-----------------------------+------------------------------+
        |                             |                              |
   CI/Operations                 Geospatial                     Research
        |                             |                              |
 GitHub Actions               CityEngine/Unreal                 Quantum
        |                       optional workers                 isolated
        |                             |                              |
 Bash validation             asset manifests / 3D                 OpenFermion
 Container test env           Tiles/glTF contracts                 adapters
 Infra patterns               CRS + datum gates                    |
        |                             |                              |
        +-----------------------------+------------------------------+
                                      |
                         evidence / provenance / SBOM
                                      |
                         release + deployment gates
```

### 4.1 Canonical ownership

TSM owns its workflows, contracts, scripts, schemas, manifests, and documentation. External repositories remain upstream sources. No external repository becomes a git subtree, vendored monorepo, or hidden runtime dependency merely because it provides useful code.

### 4.2 Capability registry

Create a machine-readable registry under `integrations/registry/` containing, for each source:

- canonical repository URL;
- pinned reference (commit/tag where practical);
- capability classification;
- allowed use;
- license/provenance status;
- runtime/build boundary;
- security classification;
- required host/platform/toolchain;
- upgrade procedure;
- validation contract.

### 4.3 CI topology

The default path remains GitHub-hosted runners. The main CI workflow remains the authoritative application gate. Specialized workflows become independently triggerable and report contract status without duplicating the full application pipeline.

Target logical sequence:

```text
Checkout
 -> exact commit verification
 -> dependency/lockfile verification
 -> environment integrity
 -> repository integrity
 -> curated DevOps validation
 -> geospatial contract validation
 -> optional CityEngine/3D contract validation
 -> optional container/service validation
 -> parse
 -> TypeScript
 -> production build
 -> unit/integration tests
 -> digital-twin contract tests
 -> isolated quantum contract tests
 -> artifact generation
 -> SBOM/provenance/security gates
```

Specialized heavyweight jobs use `workflow_call` or explicit workflow dispatch and run only when their inputs are present. CityEngine/Unreal work is routed to dedicated self-hosted Windows infrastructure when actually required. Quantum tests use a separate Python environment and cannot block ordinary geospatial CI unless the changed files declare a quantum capability dependency.

### 4.4 CI consolidation

`ci.yml` becomes the canonical application gate. `tsm-console-ci.yml` is either reduced to a thin compatibility wrapper or removed after equivalent coverage is demonstrated. No two workflows may independently define divergent build/test truth for the same console artifact.

### 4.5 Infrastructure boundary

GitLab/Ansible/Vagrant patterns are reference architecture for optional self-hosted infrastructure. They do not replace GitHub Actions. Docker patterns are used to create deterministic integration-test environments around PostGIS and other service dependencies, not to reproduce the legacy CI-tool demonstration stack wholesale.

### 4.6 Geospatial boundary

The geospatial integration layer consumes authoritative DEM/LiDAR, HEC-RAS, regulatory, telemetry, and cadastral inputs according to TSM contracts. CRS and vertical datum metadata remain explicit. The digital-twin renderer is downstream of quantitative engineering outputs, consistent with the project architecture.

The existing project material defines EPSG:2966/NAVD88 as authoritative geospatial anchors and identifies USGS 3DEP, Indiana GIO, HEC-RAS, USGS NWIS, FEMA NFHL, IDNR BAFM, and other authoritative sources. These are data authorities; external GitHub repositories are capability sources and must not override them.

### 4.7 CityEngine / Unreal boundary

CityEngine/Unreal becomes an offline/asset-build capability. The output contract is a versioned asset manifest describing source CRS/datum, asset identity, generated format, provenance, build toolchain, and hash. TSM consumes validated outputs rather than embedding the CityEngine SDK or Unreal plugin in the browser application.

CityEngine for Unreal requires Unreal Engine 5 and Windows according to its repository documentation. The CityEngine SDK documentation specifies current toolchain requirements and licensing. Therefore these workloads are conditional and cannot be part of the default Ubuntu application build.

### 4.8 Quantum boundary

OpenFermion-Cirq is treated as a research adapter source. A quantum capability contract defines input/output schemas and deterministic simulator test vectors. Quantum experiments cannot mutate regulatory state, evidence records, or production geospatial calculations. The adapter is opt-in and isolated from the ordinary CI dependency graph.

## 5. Security and provenance

External source integration follows least privilege and pinning:

1. Pin actions and external dependencies to reviewed versions or immutable commits where practical.
2. Never execute arbitrary fetched shell content during CI.
3. Curate shell utilities into TSM-owned scripts and test them independently.
4. Do not place secrets in workflow files, Docker Compose fixtures, source code, or generated manifests.
5. Use ephemeral CI credentials and minimal GitHub permissions.
6. Generate source/provenance metadata for every imported capability.
7. Generate an SBOM for releasable artifacts and record dependency provenance.
8. Keep evidence/provenance records separate from visualization artifacts.

The project source material requires SHA-256 evidence hashing, explicit data contracts, deterministic generation, and clear labeling of non-live components. Those principles are preserved in this integration architecture.

## 6. Testing

### Required tests

- Workflow YAML/schema validation.
- Duplicate-pipeline detection.
- Lockfile registry/provenance validation.
- Shell syntax and safe-execution checks.
- Geospatial CRS/datum contract tests.
- 3D asset manifest and glTF/3D Tiles contract tests when assets are present.
- Docker service health/integration tests.
- CityEngine/Unreal adapter contract tests on eligible self-hosted runners.
- Quantum adapter tests in an isolated Python environment.
- Existing parse, typecheck, build, and complete test suites.
- Artifact hash/provenance/SBOM validation.

### Non-goals

- Running Unreal Engine on ordinary GitHub-hosted Ubuntu runners.
- Making GitLab infrastructure a prerequisite for TSM CI.
- Vendoring complete external repositories.
- Treating reference repositories as authoritative geospatial data sources.
- Allowing quantum code to influence public-safety or regulatory decisions autonomously.

## 7. Acceptance criteria

The integration is accepted only when:

1. `ci.yml` remains the single canonical application CI gate.
2. The duplicate console workflow no longer creates divergent build/test truth.
3. All seven sources are represented in the capability registry with provenance and licensing status.
4. No unreviewed third-party code is copied into production paths.
5. CityEngine/Unreal capability is optional and platform-gated.
6. Quantum capability is isolated and opt-in.
7. Docker/infrastructure references are reusable without making legacy stacks mandatory.
8. Geospatial contracts fail closed on CRS/datum or manifest violations.
9. Existing application parse/type/build/test gates remain green.
10. Build artifacts carry reproducible provenance metadata and security/SBOM gates.

## 8. Source grounding

The TSM engineering source material establishes the existing GitHub/Replit/Vercel delivery path, the separation of authoritative/computational/visual truths, and the need to keep authoritative measurements and regulatory determinations outside the visualization client. The PTDT v35 material defines the geodetic anchors, deterministic solver/data structures, provenance model, and CI verification direction. The current GitHub repository confirms the two overlapping CI workflows and the package-level validation scripts.

External repository reconnaissance is recorded in this design rather than treated as a license to copy their implementations.
