# TSM mapping-plane implementation status and completion gates

**Reviewed:** 2026-10-18  
**Main baseline:** `6516528cd8ca7be28d965c9112a038df071ec54f`  
**Purpose:** distinguish working foundations, data-gated functions, research proposals, and release checks. This is a status ledger, not an assertion that every proposed advanced technique has been shipped.

## Executive disposition

TSM has an established four-plane architecture, a home-site AOI evidence record, a conventional OGC 3D Tiles 1.1 HLOD building pipeline, and explicit evidence/approval gates. The remaining work is not solved by adding parallel renderers or adopting a research state word prematurely. It is to close the verified correctness and provenance gaps below, keep release gates reproducible, and defer experiments that have no demonstrated TSM benefit.

The following state distinctions govern this tracker:

- **Implemented baseline** means repository code/contracts and existing CI cover a defined capability; it does not mean every dataset or operational scenario is validated.
- **Data-gated / blocked** means an upstream evidence or human-review prerequisite is missing or contradictory; the correct completion behavior is to preserve the blocker.
- **Research / deferred** means an idea is not a TSM release requirement until a specific use case and measured gap justify it.
- **Pending CI** means the change exists on a proposed branch but has not been merged or verified by the relevant GitHub Actions run.

## Four-plane implementation matrix

| Plane | Existing foundation | Status and exit gate |
|---|---|---|
| **1. Evidence & Data Governance** | Machine-readable four-plane contract; source/acquisition manifests; provenance and SHA-256 checks; USGS, FEMA, Indiana GIO and water-source references. | **Baseline implemented; site evidence incomplete.** Keep source bytes, source date/version, query, CRS/datum/units, raw value, normalized value and hashes attached to each artifact. The home-site AOI contract notes the original uploaded image has not been stored in the repository evidence directory. Resolve this before treating the imagery as a reproducible input. |
| **2. Scientific & Simulation** | Versioned HEC-HMS/HEC-RAS handoff manifests, hydrology pipeline contracts, datum/CRS checks and fail-closed model state. | **Home-site run blocked.** The home AOI record states the catchment is `NOT_DELINEATED`, HEC-HMS and HEC-RAS are `NOT_RUN`, and the coupled model readiness state is `BLOCKED_NOT_RUN`. Do not treat an EPQS point sample, a HUC boundary, parcel area, or an ERDC confluence study as a site catchment or property-specific hydraulic result. |
| **3. Governance & Decision** | Explicit human approval states, evidence lineage, jurisdiction overlays and restrictions against AI silently making regulatory decisions. | **Approval blocked by evidence.** The home-site AOI remains `USER_SELECTED_CANDIDATE_NOT_ENGINEERING_APPROVED`; approval is `NOT_APPROVED`. The evidence record flags an unresolved conflict between the current parcel centroid and a previously supplied planning envelope (about 5.1 km). Preserve both sources and reconcile the geometry before approval; do not overwrite either point silently. |
| **4. Public Experience / Visualization** | MapLibre GL JS primary renderer, optional separate WebGPU presentation contract, glTF/3D Tiles pipeline, Cesium validator and versioned build artifacts. | **Core pipeline implemented; HLOD error-policy follow-up pending CI.** Empty partition nodes must not claim progressively lower error solely because tree depth increases when no generalized geometry was generated. Structural tests and full geospatial CI are being added. Target-renderer camera-path and spatial-boundary behavior remain explicit acceptance gates. |

Sources of truth: [four-plane contract](../FOUR-PLANE-ARCHITECTURE.md), [home-site AOI automation contract](../hydrology/HOME-SITE-AOI-AUTOMATION-CONTRACT.md), [home-site evidence record](../../data/posey-county/evidence/13101-bonebank-road-site-aoi-v1.json), and [3D Tiles HLOD production pipeline](../3d-tiles-hlod-pipeline.md).

## Mapping-plane roadmap phase gates

### Phase 0 — Inventory and scope

**State: completed as a documented inventory; keep current implementation evidence live.**

The repository has an explicit application-level LOD contract, 3D Tiles 1.1 pipeline, four-plane architecture and optional WebGPU presentation contract. Do not duplicate an existing contract or assume that planned LOD2/LOD3, WebGPU, CityEngine or Cesium for Unreal features are universally operational.

**Exit evidence:** code path, contract, CI workflow and known gap are linked for each production capability.

### Phase 1 — Interoperable asset contract

**State: partial; validate provenance coverage on a per-asset basis.**

Continue using the existing schemas/manifests. Each published asset must keep a stable source identity, license/attribution where applicable, source/capture/process dates, CRS, vertical datum and units, transformation metadata, bounds, quality flags and SHA-256 lineage. Unknown CRS/datum stays unknown and blocks engineering use.

**Exit evidence:** schema validation, deterministic parsing, coordinate control-point/round-trip tests, and input/output hash checks.

### Phase 2 — Geometry and material pipeline

**State: pipeline implemented for the current LOD1 building path; HLOD error-policy regression added on a follow-up branch.**

Keep source geometry and provenance, transformations, LOD1 extrusions, spatial grouping, stitching, Draco compression and strict validation in the existing pipeline. Parent simplification error must not be fabricated from tree depth. A future lower-error parent requires actual generalized renderable content, known error semantics, representative camera tests and OGC/TSM validation.

**Exit evidence:** Python fixture test; full 23,082-feature production pipeline; strict TSM validation; Cesium 3D Tiles validation; glTF validation; reviewed rendering behavior on the target renderer.

### Phase 3 — Progressive delivery and state scheduling

**State: conventional 3D Tiles refinement is the baseline; B-D-C-T-S implementation deferred.**

The published 2026 five-dimensional state-word paper is a research proposal, not an OGC requirement. Do not add a 16-bit scheduler until TSM benchmarks show a limitation that existing tiling and renderer controls do not solve. If reconsidered, first define legal field values and combinations, versioning, serialization, fallback rules, preservation of authoritative semantics, exhaustive encode/decode tests and a measured comparison against baseline.

**Exit evidence to reopen this proposal:** documented TSM use case, reproducible baseline measurements, accepted compatibility design and tests.

### Phase 4 — Optional volumetric terrain research

**State: deferred, not a production prerequisite.**

Keep SDF/voxel terrain, GPU compute meshing and Transvoxel behind a separate experiment. Do not replace source DEM/TIN or hydraulic terrain inputs with renderer-specific approximations.

**Exit evidence to reopen:** benchmark on representative devices and datasets for accuracy, seams, startup time, memory, compatibility and fallback behavior.

### Phase 5 — Release and operational gates

**State: main-baseline workflow set passed; the HLOD follow-up must earn its own checks.**

On the main merge baseline `6516528…`, the post-merge runs reported success for the production build/deploy, CI pipeline, parse gate, CodeQL, secret scanning, open-world validation, standard offline runtime, Windows x64 offline runtime, and eight-county exact-boundary acquisition. The Windows x64 run uploaded the artifact below. This confirms those runs only; it does not pre-approve the proposed HLOD changes or establish an engineering conclusion for the home AOI.

- Windows workflow: [run 39095620592](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/39095620592)
- Artifact: `TSM-OFFLINE-RUNTIME-WINDOWS-X64-e28a90e2b97d7354b61e2bed7eafd5fe85043f23`
- Reported archive size: 715,581,684 bytes
- SHA-256 reported by GitHub artifact metadata: `3df98006ccfb989b4fda9a03f49a9fe4f7cec2735d23a54ff255b403fdfc1ebf`
- Artifact expires: 2026-11-17T04:07:59Z

The Windows workflow currently generates `tsm-console/src-tauri/Cargo.lock` during CI because no committed lockfile exists at that path. Offline resolution passed in the verified run, but a reviewed committed lockfile is still the stronger reproducibility model. Do not fabricate one; produce it in a compatible Rust environment, verify the offline build, then commit it.

## Home Hydrology AOI: non-negotiable blocker ledger

The existing AOI record correctly separates parcel, structure, catchment, and hydraulic model domain. These blockers remain release-blocking for any site-specific HMS/RAS run:

1. Store and hash the original user-provided imagery byte-for-byte; reconcile it to the current parcel/structure evidence without overwriting the prior location conflict.
2. Acquire and QA actual DEM coverage, native resolution, acquisition/product, nodata/artifacts, horizontal CRS, vertical datum and units. EPQS is a point-service sample, not the site DEM.
3. Verify the real receiving outlet/conveyance before delineating a hydrologic catchment; inspect culverts, roads, berms, ditches and low-relief drainage.
4. Query effective FEMA FIRM/FIS and relevant Indiana DNR flood products; review parcel and structure geometry. Raw `-9999` values remain missing data, not elevations.
5. Complete model-input manifests, boundary conditions, calibration/validation evidence and uncertainty review. Obtain a named, dated human approval for a declared use.
6. Keep HEC-HMS and HEC-RAS execution at `BLOCKED_NOT_RUN` until all relevant gates pass.

No site-specific flood depth, design flow, BFE, no-rise conclusion, permit determination or engineering approval is claimed by this tracker.

## External standards and research basis

- [OGC 3D Tiles 1.1 specification](https://docs.ogc.org/cs/22-025r4/22-025r4.html): geometric error, bounding volumes, transforms, content and refinement.
- [CesiumJS issue #9356 — refinement of mixed empty and non-empty tiles](https://github.com/CesiumGS/cesium/issues/9356): implementation behavior around empty nodes.
- [CesiumGS 3D Tiles validator](https://github.com/CesiumGS/3d-tiles-validator): validates 3D Tiles 1.0/1.1 structure and supported tile content; it does not by itself prove renderer refinement quality.
- [USGS 3DEP](https://www.usgs.gov/3d-elevation-program) and [USGS 3D Hydrography Program](https://www.usgs.gov/3d-hydrography-program/access-3dhp-data-products): authoritative starting points for terrain and hydrography evidence.
- [FEMA Map Service Center](https://msc.fema.gov/portal/home) and [Indiana best available floodplain mapping](https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/the-indiana-best-available-floodplain-mapping): site-review sources that require effective-product and local applicability checks.
- Zhang et al. (2026), [B-D-C-T-S 16-bit WebGIS state-word proposal](https://doi.org/10.3390/ijgi15050215): optional research extension, not a normative OGC requirement.
