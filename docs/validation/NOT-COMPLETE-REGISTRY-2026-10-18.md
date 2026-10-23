# NOT COMPLETE — Technical Gaps Registry (2026-10-19)

This registry is the authoritative list of the five remaining terrain/geospatial implementation gaps tracked in this workstream. Status is based on committed code and available evidence, not on the presence of a file or a queued CI run.

## 1. Hierarchical-Z / GPU occlusion and Nanite plane B

- **Status:** Advanced scaffold; production GPU occlusion is not complete.
- **Present:** CPU depth-pyramid utility, renderer/camera integration scaffolding, meshlet import/cull contracts, and demo smoke coverage.
- **Outstanding:** Real scene-depth integration; supported WebGPU compute path and browser/device compatibility; GPU resource lifecycle and context-loss recovery; deterministic test scene and reference results; Chrome/WebGPU-capable CI; performance and correctness measurements against a known visibility reference.
- **Acceptance evidence:** GPU-backed tests demonstrate identical or bounded-error visibility results against a CPU reference across occlusion edge cases; tests cover resource teardown/context loss; a supported browser/device matrix and measured performance report are committed.
- **Scope boundary:** WebGL2 occlusion queries and a CPU depth pyramid are not GPU Hierarchical-Z. Meshlet import/culling is not a production Nanite equivalent to Unreal Engine 5.

## 2. County-scale Transvoxel terrain stitching

- **Status:** Algorithm/table and LOD-scheduling components exist; county-scale mesh generation and field validation remain incomplete.
- **Present:** Lengyel transition-cell classification table, stitcher integration, and 2:1 LOD scheduling contracts.
- **Outstanding:** End-to-end mesh emission from real neighboring terrain tiles; transition coverage at all supported LOD boundaries; seam/crack checks; nodata, tile-edge, and mixed-resolution behavior; memory/runtime measurements at the declared AOI scale.
- **Acceptance evidence:** Reproducible fixtures for all supported transition cases, automated seam/topology checks, deterministic output hashes, and a measured representative-county run with inputs and hardware/runtime recorded.
- **Scope boundary:** A complete lookup table or synthetic fixture does not prove county-scale production readiness.

## 3. Full C/S state transitions and terrain/asset coverage

- **Status:** Streaming lifecycle and adaptive scheduling components exist; complete AOI asset coverage and operational recovery are not verified.
- **Present:** Tile lifecycle state machine, fetch bridge integration, and bandwidth-adaptive concurrency controls.
- **Outstanding:** Exact AOI manifest for required source assets; coverage and nodata report; cancellation/timeout behavior across providers; cache freshness and eviction tests; offline/online transition tests; alternate-source recovery on representative missing-source cases.
- **Acceptance evidence:** A committed manifest/report binds source IDs, hashes, CRS/datum, acquisition times, coverage, and gaps; deterministic tests exercise timeout, cancellation, partial coverage, stale cache, provider failure, and recovery without fabricating data.
- **Scope boundary:** An empty or partial data catalog cannot be represented as complete geographic coverage.

## 4. System-wide CRS, vertical datum, epoch, and accuracy evidence

- **Status:** Evidence schema and validation helpers exist; whole-catalog coverage has not been demonstrated.
- **Present:** Elevation evidence product, terrain evidence assertions, and batch coordinate-validation harness.
- **Outstanding:** Execute the harness against the complete supported feature/source catalog; report missing/unsupported CRS, vertical datum, coordinate epoch, units, transformation-grid/version, accuracy class, and source provenance; test the report against a pinned catalog snapshot.
- **Acceptance evidence:** A committed, machine-readable catalog coverage report with denominator, numerator, skipped records, error categories, and input snapshot digest; CI checks the report for unintended regressions. Unknown transformations remain explicitly unavailable and are not approximated silently.
- **Scope boundary:** A validator or schema does not prove every catalog record has valid metadata. Survey-grade accuracy must not be inferred from metadata presence.

## 5. Multi-device occlusion, rendering, and performance validation

- **Status:** Partial; no representative device-lab evidence is committed.
- **Present:** Renderer diagnostics and context-loss/degraded-rendering scaffolding.
- **Outstanding:** Test profiles for low-, mid-, and high-tier hardware; mobile WebView and desktop browser coverage; memory/GPU budget; thermal/performance observations; render correctness under resize, context loss, network degradation, and layer failure.
- **Acceptance evidence:** Reproducible benchmark protocol, device/browser/runtime versions, raw result artifact, percentile timings, memory measurements, failure observations, and explicitly declared support limits.
- **Scope boundary:** A successful desktop build is not evidence of cross-device performance or mobile compatibility.

## Verification updates (2026-10-23)

- Added a WebGPU probe that distinguishes API absence, adapter failure, device-creation failure, and a usable device; the `ready` state explicitly does not imply that a terrain workload is implemented.
- Removed the placeholder GPU mesh behavior: `extractMesh()` now raises an explicit `WebGPUWorkloadUnavailableError` instead of returning an empty array that could be misinterpreted as valid geometry. Device-loss state is observed and exposed.
- Hardened the CPU depth pyramid against invalid dimensions, non-finite/out-of-range depth samples, and off-screen/invalid query rectangles. Invalid queries conservatively remain visible; the implementation remains CPU-only.
- Added automated contract tests for these behaviors. These are software-level improvements, not closure of the hardware/data-dependent acceptance gates below.

## Release status

These five items remain open until their acceptance evidence is committed and CI has completed against the exact candidate commit. A queued, pending, or cancelled workflow is not a passing result. If external datasets, services, or suitable hardware are unavailable, record the limitation and keep the affected capability marked unverified rather than inventing evidence.

See also:
- [Engineering Assurance Standard](../architecture/ENGINEERING-ASSURANCE-STANDARD.md)
- [Finishing touches inventory](FINISH-TOUCHES-2026-10-19.md)
- [Nanite plane integration](../architecture/NANITE-PLANE-INTEGRATION-2026-10-19.md)
