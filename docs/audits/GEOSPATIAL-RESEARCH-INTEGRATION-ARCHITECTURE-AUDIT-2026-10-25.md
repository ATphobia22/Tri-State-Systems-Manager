# TSM Geospatial Research Integration — Architecture Audit

**Review date:** 2026-10-25  
**Repository:** `ATphobia22/Tri-State-Systems-Manager`  
**Reviewed branch:** `main`  
**Reviewed commit:** `301b20efd8c893ddc80275564f4ac6f17b389b2f`  
**Scope:** repository architecture, geospatial data/engineering boundaries, CI/release evidence, and compatibility of the supplied AI/GIS/earth-observation/3D research.  
**Change class:** documentation-only audit; no runtime dependencies, secrets, model behavior, or authoritative-data claims are changed.

## Executive result

TSM already contains a broad geospatial and hydrology platform: React/Vite/MapLibre presentation, Python geospatial and engineering code, QGIS/GDAL-oriented workflows, source registries, PostGIS-related artifacts, NOAA/USGS/FEMA/Indiana data contracts, engineering evidence controls, and separate CI workflows. The immediate architectural need is **integration discipline and end-to-end evidence**, not a second GIS stack or wholesale rewrite.

The existing project policy is correct for this domain: source availability is not inferred from adapter presence; observations are distinguished from forecasts; horizontal CRS and vertical datum are separate; synthetic values must not become authoritative engineering inputs; AOIs and consequential model outputs require explicit review.

## Repository snapshot and release evidence

- `main` was observed at `301b20efd8c893ddc80275564f4ac6f17b389b2f`, with a signed commit titled “Enforce geodetic datum and USGS topo-source evidence gates.”
- The repository tree contains many specialized workflows, including canonical CI, geospatial CI, Pages deployment, offline runtime, secret scanning, weather-source validation, and geodetic/source validation. This is a mature but operationally complex CI surface; workflow count alone does not establish end-to-end completeness.
- The check-run collection for that commit contained **28 checks: 25 successful and 3 failed**. The three failures were Dependabot dynamic-update runs (two esbuild updates and one earlier esbuild update); the Vite update succeeded. The canonical CI `build-and-test`, geospatial `contracts`, production build/deploy, offline-runtime build, secret scan, and the latest government-data-fabric validation checks observed in this audit succeeded.
- The legacy commit-status endpoint returned `pending` with zero classic status contexts. Therefore the classic combined status is not a valid “green” signal by itself; use check runs, workflow runs, and branch rules together.
- The active repository ruleset “TSM main protection” applies to `main` and blocks deletion and non-fast-forward updates. The branch API reported `protected: true`, but legacy branch-protection required checks were disabled/empty. Verify the ruleset and check requirements remain aligned.
- There are multiple open PRs in the same geospatial/evidence area, including PR #390 (“harden Phase 1 geospatial ingestion and artifact contracts”) and PRs #385–#389 for adjacent evidence/runtime work. PR #390 has a base SHA older than the current main SHA and is not mergeable in the inspected metadata. Avoid duplicating its datum policy, PMTiles validation, or FEMA BLE separation without first reconciling its diff and checks.

Evidence links:
- [Reviewed main commit](https://github.com/ATphobia22/Tri-State-Systems-Manager/commit/301b20efd8c893ddc80275564f4ac6f17b389b2f)
- [Main CI run](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/40135026437)
- [Geospatial CI run](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/40135026402)
- [Production build/deploy run](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/40135026413)
- [Latest government data fabric validation](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/40182538949)
- [Open geospatial Phase 1 PR #390](https://github.com/ATphobia22/Tri-State-Systems-Manager/pull/390)

## Existing architecture to preserve

1. **Experience/presentation:** MapLibre and 3D Tiles/terrain clients; visualization output must not silently acquire engineering or regulatory authority.
2. **Operations and processing:** existing backend Python, Node/TypeScript packages, scripts, and geospatial processing tools. Add integrations through current package boundaries rather than creating parallel pipelines.
3. **Authoritative source fabric:** NOAA/NWS/NWPS, USGS/3DEP/NWIS, FEMA/NFHL, state and local records. Each adapter must report live availability separately from registered source metadata.
4. **Scientific/engineering boundary:** established deterministic solvers and real model artifacts remain distinct from AI recommendations and visual reconstruction.
5. **Evidence/provenance:** source identity, retrieval time, native identifiers, hashes, CRS, vertical datum, units, transformation metadata, model version, and review state are retained with artifacts.
6. **Human review and governance:** no automatic filing, regulatory determination, AOI approval, or consequential model run from a language-model suggestion alone.

The source-of-truth documents already in the repository include `docs/ARCHITECTURE-CURRENT-STATE.md`, `docs/architecture/GEODETIC-REFERENCE-AND-TOPO-SOURCES.md`, `docs/architecture/ENGINEERING-ASSURANCE-STANDARD.md`, `contracts/registries/tsm-incomplete-capability-registry-v1.json`, and `docs/architecture/INCOMPLETE-CAPABILITY-AND-RELEASE-GAP-IMPLEMENTATION-2026-10-23.md`. Treat the capability registry as a required source of truth for partial/unverified work; do not re-label entries as complete without evidence.

## Research disposition

| Research lead | TSM disposition | Integration boundary and acceptance |
|---|---|---|
| Modular MAX 26.7 | **Evaluate only; no migration now** | Optional model-inference backend behind an existing provider interface. Benchmark latency, throughput, peak host/device memory, numerical behavior, supported operators, deployment footprint, license, and fallback behavior against the current runtime. Not a GIS or hydrology solver. |
| Reported TerraLab QGIS agent benchmark | **Prototype/evaluate in a sandbox** | Test on a TSM-owned held-out suite: CRS inspection, spatial joins, raster metadata, source discovery, map generation, and incomplete-input detection. Record exact model/plugin version, task prompts, expected outputs, source citations, success criteria, and unsafe-action rate. Vendor-reported benchmark scores are not independent proof of superiority. |
| Bhubaneswar building-level climate digital twin | **Architecture reference** | Reuse the pattern of hazard/exposure layers and building/road/public-facility aggregation, but only where TSM has source-supported coverage. Expose spatial/temporal resolution, uncertainty, provenance, and model status; do not infer parcel/building accuracy from display granularity. |
| Google Earth / Earth Engine historical change | **High-value data/analysis candidate** | Consider for land-cover, surface-water, and urban-change analysis via a versioned adapter/export workflow. Verify account/access requirements, data and export terms, source dates, resolution, reproducibility, and licensing before production use. Preserve original imagery/catalog identifiers. |
| Hi3D open-source 3D reconstruction | **Optional visualization experiment only** | Isolate from authoritative terrain/hydrology pipelines. Generated geometry may be a scene/asset aid but must not be used as survey-grade elevation, bathymetry, hydraulic boundaries, parcel dimensions, or design evidence without independent validation against authoritative measurements. |
| NOAA NWS GIS services | **Existing-source alignment first** | Reuse the current NOAA catalog and weather/source validation workflows. Add only missing products or validated endpoint metadata; do not add a duplicate catalog. |
| NOAA National Water Model | **Existing-source alignment first** | Check the current live hydrology fabric and source registry before adding a second adapter. Preserve forecast cycle, valid time, reach/grid identity, units, model/version, and latency. Keep guidance separate from observations and official warning products. |
| USGS 3DEP | **Existing-source alignment first** | Reuse the current terrain/elevation registry, AOI coverage manifest, and geodetic evidence gates. Require acquisition/version, vertical reference, units, coverage/nodata report, hashes, and independent validation as appropriate. |

## Findings and recommended actions

### P0 — Release evidence and integration control

1. **Separate green build evidence from release acceptance.** The observed canonical CI, geospatial CI, deployment, and offline build checks succeeded on the reviewed commit, but three Dependabot runs failed and the classic status endpoint is pending/empty. Report status per required workflow and per current SHA; never flatten all activity into “green.”
2. **Reconcile active PRs before parallel implementation.** Review PR #390 and adjacent PRs #385–#389 for overlap, current-base compatibility, required checks, and stale branch status. Rebase/update only after examining the exact diffs and checks; merge only when the current head passes applicable gates.
3. **Keep release-gate registries honest.** Preserve `PARTIAL`, `OPEN`, `GATED_OPERATOR`, `UNAVAILABLE`, and `NOT_VERIFIED` states. A passing contract test is evidence for that contract, not proof of live source coverage, model calibration, or deployment behavior.
4. **Validate CI security posture.** Workflows inspected use explicit read-only permissions in key workflows and full-SHA action pins in reviewed examples. Audit every workflow, including scheduled/dynamic and deployment workflows, for least privilege, untrusted PR execution, secret exposure, artifact trust, action pinning/lockfiles, and protected-branch required checks. Do not infer repository-wide security clearance from one workflow.

### P1 — End-to-end geospatial evidence contract

Standardize an artifact envelope for each data ingest, analysis, and model run. At minimum include:
- schema/version and artifact type;
- source authority, canonical URI/endpoint, native identifier, and source version or observation/forecast timestamps;
- acquisition time, processing time, and freshness policy;
- horizontal CRS/reference frame, realization/epoch where relevant, vertical datum/height type, units, and transformation provenance;
- geometry/raster extent, resolution, nodata and coverage statistics;
- content hash and parent/input artifact hashes;
- processing code/model version and parameters;
- validation results, uncertainty/limitations, review state, and reproducibility pointer.

Fail closed when required scientific metadata is absent or incompatible. Do not require every source to have every field: explicitly represent not-applicable fields and source-native uncertainty rather than inventing values.

### P1 — Geospatial source adapter contract

Use the current registry/provider boundary. A source adapter should:
- validate endpoint and response schema;
- apply bounded timeout, retry/backoff, rate-limit handling, and safe error classification;
- distinguish source outage, no data, partial coverage, stale data, invalid response, and local-cache fallback;
- preserve source-native IDs and time semantics;
- validate CRS, units, geometry/raster bounds, nodata, and datum metadata before promotion;
- emit deterministic evidence metadata and never substitute synthetic values for unavailable authoritative inputs.

Add a new adapter only when a documented gap exists and no existing provider covers the same contract.

### P2 — AI agent boundary

An AI/GIS agent must be a planner/client of existing tools, not a second source of truth:
- read-only discovery and analysis by default;
- allowlisted tools and workspace-scoped file access;
- typed inputs/outputs, schema validation, bounded resource use, cancellation and timeouts;
- no credentials in prompts/logs and no arbitrary shell/network execution;
- explicit user approval for writes, external filings, AOI approval, and consequential model runs;
- deterministic postconditions and provenance capture for every tool execution;
- agent output is marked advisory until deterministic validation and review complete.

### P2 — Performance/3D experiments

Do not introduce MAX or Hi3D as mandatory dependencies in the first integration. Run isolated, reproducible comparisons only after correctness and data contracts are established. Use real source-backed inputs, record device/runtime versions, and publish benchmark methodology and failure cases as well as successful runs.

## Suggested acceptance sequence

1. Refresh `main`, open PRs, check runs, and ruleset evidence before any merge or release claim.
2. Reconcile the geospatial/evidence PR stack; avoid duplicating PR #390.
3. Produce a source-to-artifact trace for one bounded, explicitly approved test AOI using existing NOAA/USGS/FEMA sources. Keep AOI approval explicit; address or county context alone is not a hydraulic-model authorization.
4. Verify source freshness, CRS/vertical datum, units, coverage/nodata, content hashes, and input-to-output lineage.
5. Run existing offline contract tests, targeted geospatial tests, security checks, and required GitHub workflows on the exact candidate SHA.
6. Add an AI agent only after it can execute the same workflow through allowlisted tools with deterministic output checks and an auditable trace.
7. Evaluate MAX and 3D reconstruction separately; retain a documented fallback and prevent visual products from entering the engineering evidence plane.
8. Update capability/release registries with evidence links and explicit remaining limitations.

## Validation record and limitations

- **Repository inspection:** GitHub API repository metadata, recursive tree, main branch ref, relevant architecture/registry/workflow files, open PR metadata, active ruleset, workflow runs, and check runs were inspected on 2026-10-25.
- **Remote checks:** the reviewed commit had 28 check runs: 25 success, 3 failure (all three failed runs were Dependabot dynamic esbuild updates). Key canonical CI, geospatial CI, production deployment, offline runtime, secret scan, and latest government-data-fabric validation checks observed in this review succeeded.
- **Not run in this audit:** no local checkout or local test/security command was executed by this audit process; no fresh workflow was dispatched. Existing remote checks are historical evidence for their exact SHAs, not a test result for this documentation branch.
- **Not changed:** no application code, dependency manifests, lockfiles, source registries, AOI status, model output, secrets, or deployment configuration.
- **Not claimed:** full security clearance, complete hydrology validation, complete AOI terrain coverage, building-level prediction accuracy, production AI-agent integration, MAX performance improvement, or survey/engineering certification.

## Primary references

- [Modular MAX 26.7](https://www.modular.com/blog/26-7)
- [TerraLab QGIS agent benchmark announcement](https://www.abnewswire.com/pressreleases/best-ai-agent-for-gis-free-ai-agent-for-qgis-scores-438-on-google-researchs-geospatial-ai-benchmarks-ahead-of-claude-and-gpt6_843516.html)
- [Bhubaneswar climate digital twin report](https://urbanacres.in/bhubaneswar-climate-digital-twin-maps-risk-building-by-building/)
- [Google Earth / Earth Engine research article](https://medium.com/google-earth/four-decades-of-planetary-change-now-open-for-everyone-to-build-on-9b32d6cb8c86)
- [Hi3D V1.0 announcement](https://www.prnewswire.com/news-releases/hi3d-v1-0-goes-open-source-the-first-production-validated-open-source-ai-3d-model-302917998.html)
- [NWS Cloud GIS services](https://www.weather.gov/gis/cloudgiswebservices)
- [NOAA National Water Model](https://water.noaa.gov/about/nwm)
- [USGS 3D Elevation Program](https://www.usgs.gov/3d-elevation-program)
- [GitHub Actions security hardening guidance](https://docs.github.com/en/actions/reference/security/secure-use)
