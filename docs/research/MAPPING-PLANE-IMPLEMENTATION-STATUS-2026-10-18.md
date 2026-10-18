# Mapping-plane implementation status and release gates

**Review date:** 2026-10-18  
**Reviewed base:** `main` at `e66abd08c0cc6c7c1d34b3f3eb124200970ab8eb`  
**Implementation branch:** `fix/3d-tiles-hlod-renderer-hardening`  
**Purpose:** map roadmap statements to concrete repository contracts, code, and verifiable acceptance gates. This is not a claim that every proposed feature or data-dependent model is complete.

## Plane-by-plane status

| Plane | Existing implementation anchors | Status / unfinished gates |
|---|---|---|
| Evidence and data governance | `data/acquisitions/tsm-authoritative-source-manifest-v1.json`, `data/acquisitions/tsm-data-plane-integration-v1.json`, `data/schemas/evidence-manifest.schema.json`, `scripts/ci/validate-provenance-plane.mjs`, `data-sources/manifests/` | Contracts and CI checks exist. AOI-specific freshness, coverage, CRS, vertical datum, units, retrieval timestamps, and source hashes still require current acquisition evidence. |
| Scientific simulation | `docs/hydrology/HEC-HMS-RAS-REPRODUCIBLE-WORKFLOW.md`, `docs/hydrology/HYDROLOGY-RELEASE-CONTRACT.md`, `scripts/hydrology/run-hec-coupled-workflow.mjs`, HEC run-manifest validators | Orchestration and safety contracts exist. Do not run or present a site-specific HEC-HMS/HEC-RAS model until the AOI, terrain, hydrography, boundary conditions, datums, solver environment, and human scope approval gates pass. |
| Governance and decisions | `docs/FOUR-PLANE-ARCHITECTURE.md`, `data/schemas/tsm-four-plane-architecture-v1.json`, jurisdiction and authority-boundary contracts | Architecture and authority boundaries exist. CI success is not human approval, regulatory certification, or an engineering determination. |
| Public experience and visualization | `docs/TSM-LOD-CONTRACT.md`, `docs/WEBGPU-PRESENTATION-CONTRACT.md`, `scripts/geospatial/build-hlod-tileset.py`, `scripts/geospatial/validate-building-3d-tiles.py`, `tsm-console/src/components/ThreeDTilesLayer.tsx`, `tsm-console/src/lib/martin-tile-fabric.ts` | 3D Tiles pipeline and active renderer integration exist. This change adds an HLOD error-floor policy, zoom-aware camera clipping, resize-aware screen-space-error resolution, URL validation, and regression tests. Target-renderer camera-path, refinement-boundary, and performance tests remain required. |

## 3D Tiles renderer: implementation vs. proposals

### Implemented or present in repository

- 3D Tiles 1.1 building and terrain assets, HLOD construction, GLB stitching/Draco packaging, strict local validation, SHA-256 inventory, and independent Cesium validator integration in the existing build workflow.
- A MapLibre-hosted Three.js `TilesRenderer` integration with camera/resolution synchronization and screen-space-error configuration.
- A conservative HLOD geometric-error floor for empty ADD partition nodes; the new test suite is wired into geospatial CI.
- The active `ThreeDTilesLayer` adjusts camera near/far clipping planes as zoom changes and refreshes the 3D Tiles renderer's pixel resolution on container/map resize.
- `resolveThreeDTilesetUrl` rejects unsupported schemes, embedded credentials, control characters, backslashes, and protocol-relative URLs before loader initialization.
- The unused `Tiles3DRendererLayer` adapter was removed instead of retaining a peer-dependency conflict: its plugin required Three.js `^0.178.0` while the app uses `^0.186.1`.

### Not yet a complete feature

- The 5D B-D-C-T-S state word is **not** a complete scheduler or metadata-to-shader pipeline. The current source has bit-decoding helpers and a GLSL snippet, but this renderer does not bind per-feature `EXT_structural_metadata` to an `aStateWord` GPU attribute or use it to schedule content. This remains a research/prototype integration until the data mapping, schema/versioning, fallback semantics, and end-to-end tests are implemented.
- A numeric 3D Tiles validator pass does not prove that geometric-error values produce appropriate screen-space-error refinement in the target renderer.
- The separate optional WebGPU path is not a MapLibre WebGPU custom layer; retain the existing WebGL/MapLibre fallback and explicit coordinate/provenance contract.
- CityGML LOD0–LOD3, TSM's application LOD4, and any paper-proposed LOD/state extensions must remain distinct concepts.

## HLOD error policy

The former builder divided the source root error by `2 ** depth`. Tree depth alone does not measure simplification error. Contentless ADD partition nodes now inherit a conservative error floor based on the parent floor and declared source-descendant errors; source-content leaf errors remain intact. Invalid negative, boolean, NaN, infinite, or malformed root/fallback/source values fail closed.

This is a TSM traversal policy for empty nodes, not a measured mesh simplification error or a universal OGC parent/child invariant. It may increase refinement and network work. Required acceptance beyond unit tests: run the generated tileset through the strict TSM validator and CesiumGS validator, then test representative camera distances, tile boundaries, cache pressure, and measured payload/frame-time budgets.

- [OGC 3D Tiles 1.1 specification](https://docs.ogc.org/cs/22-025r4/22-025r4.html)
- [CesiumGS 3D Tiles Validator](https://github.com/CesiumGS/3d-tiles-validator)
- [NASA-AMMOS 3D Tiles Renderer API](https://github.com/NASA-AMMOS/3DTilesRendererJS)

## Home-site AOI readiness

The candidate record is `data/posey-county/evidence/13101-bonebank-road-site-aoi-v1.json`. It remains `USER_SELECTED_CANDIDATE_NOT_ENGINEERING_APPROVED` with approval `NOT_APPROVED`.

Before a site-specific model run:
1. Reconcile the address, authoritative parcel boundary, candidate structure footprint, and current imagery.
2. Acquire/QA site terrain with resolution, coverage, NoData and vertical-datum checks; acquire hydrography, drainage infrastructure and applicable flood products with independent provenance and hashes.
3. Keep parcel, contributing catchment, and hydraulic model domain as separate geometries; independently validate the outlet and watershed.
4. Resolve rainfall/gage data, boundary conditions, units/datums, solver/runtime version, convergence/mass-balance thresholds, uncertainty, and output QA.
5. Keep the model state `BLOCKED_NOT_RUN` until input gates pass and a human approves the scientific question and scope.

An address, parcel-centroid intersection, single elevation sample, or green CI run is not enough to establish flood depth, BFE, catchment boundaries, or design conditions.

## Release and evidence policy

- Merge only after required checks pass on the exact PR head and the branch is mergeable.
- Keep the current `main` status separate from PR status; a green PR does not prove a later `main` head is green.
- A CI-built artifact proves the pipeline ran for its recorded inputs and commit; it does not certify the AOI, hydraulic model, or renderer performance.
- Keep the B-D-C-T-S scheduler, SDF/voxel terrain, and custom renderer as proposals until a demonstrated gap and a benchmarked acceptance case justify implementation.
