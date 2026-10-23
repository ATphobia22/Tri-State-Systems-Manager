# NOT COMPLETE — Technical Gaps Registry (2026-10-19)

This registry is the authoritative list of the five remaining terrain/geospatial implementation gaps tracked in this workstream. Status is based on committed code and available evidence, not on the presence of a file or a queued CI run.

## 1. Hierarchical-Z / GPU occlusion and Nanite plane B

- **Status:** Advanced scaffold; production GPU occlusion is not complete.
- **Present:** CPU depth-pyramid utility, renderer/camera integration scaffolding, meshlet import/cull contracts, and demo smoke coverage.
- **Outstanding:** Real scene-depth integration; supported WebGPU compute path and browser/device compatibility; GPU resource lifecycle and context-loss recovery; deterministic test scene and reference results; Chrome/WebGPU-capable CI; performance and correctness measurements against a known visibility reference.
- **Acceptance evidence:** GPU-backed tests demonstrate identical or bounded-error visibility results against a CPU reference across occlusion edge cases; tests cover resource teardown/context loss; a supported browser/device matrix and measured performance report are committed.
- **Scope boundary:** WebGL2 occlusion queries and a CPU depth pyramid are not GPU Hierarchical-Z. Meshlet import/culling is not a production Nanite equivalent to Unreal Engine 5.

## 2. County-scale Transvoxel terrain stitching

- **Status:** Substantially advanced 2026-10-23; full-county production run remains open.
- **Present:** Lengyel transition-cell classification tables (regenerated 2026-10-23 from the official EricLengyel/Transvoxel MIT source — the previously committed Python JSONs were theater: one truncated ending in a literal `[PLACEHOLDER]`, four empty; replaced and verified), stitcher integration, 2:1 LOD scheduling contracts, and a measured representative-county run.
- **Measured 2026-10-23:** 400 km² Posey County sub-AOI (36.8% of the county) from 4 real 3DEP 1 m tiles (SHA-256 recorded); 36,875 transition cells tested, 5,721 meshed, 28,694 verts / 17,252 tris; deterministic output (identical mesh SHA-256 across runs); 0 true cracks across 17,162 seam checks (7 one-sided mismatches at nodata margins, labeled); 21.3 s wall, 707 MB peak RSS. Full-county cost projected ~2.2 h (labeled PROJECTION, not measured).
- **Outstanding:** Full adaptive-octree extraction (the run emitted transition-face strips per the benchmark model, not full octree terrain), all-six-orientation seam coverage, and the full-county measured run.
- **Acceptance evidence (partial):** Reproducible fixtures, automated seam/topology checks, deterministic hashes, and a measured representative-county run with inputs/hardware recorded — committed in `docs/validation/transvoxel-county-run/`.
- **Scope boundary:** A complete lookup table or synthetic fixture does not prove county-scale production readiness.

## 3. Full C/S state transitions and terrain/asset coverage

- **Status:** Substantially advanced 2026-10-23; broader provider coverage remains open.
- **Present:** Tile lifecycle state machine, fetch bridge integration, bandwidth-adaptive concurrency controls, an exact AOI manifest (34 entries, committed `docs/validation/cs-coverage/aoi-manifest-2026-10-23.json`), and a coverage/nodata report (16 VERIFIED / 13 PROVISIONAL / 5 UNAVAILABLE — missing is labeled unavailable, never filled).
- **Measured 2026-10-23:** All 16 held snapshots (8 NFHL + 8 SSURGO) had SHA-256 recomputed on the VM — matched manifest claims exactly. 23 new deterministic tests (injected clock + scripted fake provider, zero network): timeout, cancellation, partial coverage, stale cache, provider 5xx/empty-body, retry-recovery — all green. Added the missing `markStale()` producer; failed providers surface labeled degraded states, no fail-closed.
- **Outstanding:** Coverage of additional providers beyond the scripted fakes, long-run cache freshness/eviction behavior under real network conditions, and offline/online transition tests on device.
- **Acceptance evidence (partial):** Committed manifest/report binding source IDs, hashes, CRS/datum, acquisition times, coverage, and gaps; deterministic tests for timeout, cancellation, partial coverage, stale cache, provider failure, and recovery.
- **Scope boundary:** An empty or partial data catalog cannot be represented as complete geographic coverage.

## 4. System-wide CRS, vertical datum, epoch, and accuracy evidence

- **Status:** Substantially advanced 2026-10-23; one missing-critical record remains open.
- **Present:** Elevation evidence product, terrain evidence assertions, batch coordinate-validation harness, and a full-catalog coverage run.
- **Measured 2026-10-23:** Harness executed against the complete supported feature/source catalog (`scripts/geospatial/crs-datum-coverage-report.mjs`); committed machine-readable report `docs/validation/crs-datum-coverage/coverage-report-2026-10-23.json` with input snapshot SHA-256: denominator 10, validated 7 (70%), 2 explicitly UNAVAILABLE (USGS 03378500 gage zero, NWPS forecast reference — never approximated), 1 missing-critical (Point Township historical, null vertical datum). 6-test regression suite + `check:crs-coverage` npm script wired for CI.
- **Outstanding:** Resolve the 1 missing-critical record (Point Township historical null vertical datum); re-run the harness as the catalog changes.
- **Acceptance evidence (partial):** Committed machine-readable catalog coverage report with denominator, numerator, skipped records, error categories, and input snapshot digest; CI regression check wired. Unknown transformations remain explicitly unavailable and are not approximated silently.
- **Scope boundary:** A validator or schema does not prove every catalog record has valid metadata. Survey-grade accuracy must not be inferred from metadata presence.

## 5. Multi-device occlusion, rendering, and performance validation

- **Status:** Partial; no representative device-lab evidence is committed.
- **Present:** Renderer diagnostics and context-loss/degraded-rendering scaffolding.
- **Outstanding:** Test profiles for low-, mid-, and high-tier hardware; mobile WebView and desktop browser coverage; memory/GPU budget; thermal/performance observations; render correctness under resize, context loss, network degradation, and layer failure.
- **Acceptance evidence:** Reproducible benchmark protocol, device/browser/runtime versions, raw result artifact, percentile timings, memory measurements, failure observations, and explicitly declared support limits.
- **Scope boundary:** A successful desktop build is not evidence of cross-device performance or mobile compatibility.

## Release status

These five items remain open until their acceptance evidence is committed and CI has completed against the exact candidate commit. A queued, pending, or cancelled workflow is not a passing result. If external datasets, services, or suitable hardware are unavailable, record the limitation and keep the affected capability marked unverified rather than inventing evidence.

See also:
- [Engineering Assurance Standard](../architecture/ENGINEERING-ASSURANCE-STANDARD.md)
- [Finishing touches inventory](FINISH-TOUCHES-2026-10-19.md)
- [Nanite plane integration](../architecture/NANITE-PLANE-INTEGRATION-2026-10-19.md)
