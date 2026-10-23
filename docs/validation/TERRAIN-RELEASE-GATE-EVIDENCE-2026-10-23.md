# Terrain and geospatial release-gate evidence protocol — 2026-10-23

This document separates implementation artifacts from acceptance evidence. Do not mark a gate complete because a shader compiles, a schema exists, or a workflow is queued.

## Current implementation in this change

- `webgpu-hierarchical-z.ts` builds a max-depth mip chain with WebGPU compute from a real `GPUTexture` depth attachment. Odd-size mip reduction partitions the complete source extent to retain edge samples.
- `webgpu-hierarchical-z-cull.ts` computes conservative candidate visibility on the GPU and returns `1` for visible/uncertain and `0` for occluded. Invalid and off-viewport candidates fail open.
- `TsmWebGpuRayTracer` now owns a `depth32float` attachment and exposes `renderFrameWithOcclusion()`, which renders a source-bound frame, builds the H-Z pyramid, dispatches GPU candidate classification on the same device, and returns visibility flags. This is opt-in and does not connect MapLibre's separate WebGL render graph to WebGPU. Device loss invalidates the renderer resources; the host must reacquire a device and rebind verified terrain resources.
- `validate-terrain-aoi-evidence.mjs` validates evidence supplied from real AOI geometry and source/raster inspection. It intentionally leaves unique AOI coverage null because overlapping footprints must be spatially unioned.
- `benchmark-real-dem-transvoxel.py` now consumes the CI-acquired GeoTIFF, reprojects a bounded patch to EPSG:32616, runs the real transition-cell mesher, hashes emitted geometry, compares adjacent-cell seam intersections, and records wall time/process peak RSS. This is a bounded transition-face run—not a full adaptive-octree terrain mesh.
- `report-crs-datum-catalog.mjs` inventories all 19 catalog entries and records missing/unverified CRS, datum, epoch, units, accuracy, vintage, and hash metadata. Its release gate remains open wherever evidence is absent.
- Provider tests exercise successful fetch, transient HTTP 503 recovery, permanent HTTP 404 fail-closed behavior, and exhausted network retries. Adapter tests exercise 13-sample transition inputs, independent coarse-side values, invalid inputs, and both signed directions.
- `webgpu-hz-reference.test.ts` compares conservative H-Z mip lookup to a CPU max-depth oracle for every rectangle at viewport sizes 1–9 pixels, including odd dimensions and far-depth holes. It does not execute the WGSL on physical GPU hardware.

## GPU H-Z acceptance

1. Run a browser/WebGPU-capable integration test against the renderer's actual depth attachment.
2. The CPU mathematical reference now exhaustively covers every rectangle for dimensions 1–9, odd/even mip sizes, and far-depth holes. Still required: compare actual GPU dispatch results against CPU outputs for full occlusion, near/far boundaries, off-screen rectangles, reversed/invalid bounds, NaN/Infinity, viewport resize, and odd dimensions.
3. Force device loss/context teardown; verify stale resources are never reused, the renderer degrades visibly, and a new device rebuilds pipelines and textures.
4. Benchmark baseline frustum/CPU culling against H-Z with identical camera path, draw list, resolution, and hardware. Report warm-up policy, sample count, p50/p95/p99 frame and culling times, false-occlusion count (must be zero), visible/candidate counts, GPU timestamp-query availability, and browser/driver/device versions. H-Z must remain disabled for workloads where its overhead regresses frame time.
5. Record raw machine-readable results and the commit SHA. Do not infer performance from literature or another GPU.

## Transvoxel acceptance

- The transition-cell table uses 9 independent fine-side scalar values to select one of 512 masks; 13 spatial sample positions include nine fine-side scalar samples that select the 9-bit case plus four independent coarse-side scalar samples used to interpolate edges touching the coarse face. Do not treat this as a 13-bit case table.
- Exhaustively enumerate all 512 transition case masks and validate all 56 equivalence classes against the canonical table. The Python fixture self-test covers all six signed face orientations; the TypeScript suite includes adjacent-cell boundary-intersection checks, which must pass on the exact release head.
- For every supported LOD face/orientation, emit adjacent meshes from shared scalar-field fixtures and check boundary edge pairing, manifoldness, no duplicate/degenerate triangles, consistent winding, and no cracks beyond the declared geometric tolerance.
- Include nodata, tile-edge, sign ambiguity, mixed-resolution, and neighboring-tile ordering fixtures. Hash deterministic mesh outputs.
- CI now runs the actual transition-cell mesher over a bounded patch derived from the downloaded Posey County 3DEP screening raster and emits source hashes, projected patch bounds, mesh counts/hash, adjacent-cell seam comparisons, wall time, and process peak RSS. The AOI remains unapproved; source-specific vertical datum, units, acquisition vintage, and accuracy are not certified. Full adaptive-octree meshing, all six orientations on real data, cross-chunk manifold proof, and hardware-specific performance remain open.

## AOI coverage, nodata, and provider recovery

- Obtain a real AOI polygon (not only an address) and hash the canonical geometry bytes. Record horizontal CRS and the exact catalog snapshot digest.
- For each source/asset, record stable source ID/URL, acquisition date, content hash, horizontal CRS, vertical datum, epoch when applicable, units, accuracy class, footprint, measured coverage fraction, measured nodata fraction, transform pipeline/version and grid dependencies.
- Produce unique AOI coverage by spatially unioning clipped footprints, and nodata from raster masks over the AOI. Per-source coverage fractions cannot be summed to derive unique coverage.
- Automated tests now cover transient HTTP 503 retry, permanent HTTP 404 failure, bounded network retry exhaustion, and the Transvoxel adapter's invalid-input handling. Cancellation, corrupt bytes, checksum mismatch, stale cache, offline/online transition, empty intersection, partial coverage, and alternate-provider recovery remain untested. Missing/failed sources must remain explicitly missing; never synthesize terrain.

## CRS, vertical datum, epoch, and accuracy

- A CI artifact now inventories every one of the 19 declared source-catalog entries, hashes the exact catalog bytes, and reports missing/unverified CRS, horizontal/vertical datum, epoch, units, accuracy, vintage, and content hash. This is a declaration audit; asset-level validation remains open.
- Report total denominator, valid numerator, skipped records, and counts by missing/invalid CRS, vertical datum, coordinate epoch, units, transformation grid/version, accuracy class, acquisition date, and content hash.
- Validate vertical transformations against an authoritative transformation service/grid and known control points. Never convert gage stage to orthometric elevation without a published station relationship; never imply survey accuracy from metadata presence.
- Store the full report, input snapshot digest, tool versions, and generated timestamp as a CI artifact.

## Cross-device matrix

At minimum, test current stable Chromium desktop on a discrete GPU, integrated-GPU laptop, and Android WebView/mobile device; include Safari/WebKit on iOS when WebGPU is supported by that exact OS/browser combination. Record unsupported combinations as unsupported, not as passed.

For each device, capture GPU adapter/features/limits, browser/OS/driver, viewport and DPR, dataset hash, warm-up frames, at least 300 measured frames, p50/p95/p99 frame time, CPU time, GPU time when timestamp queries are available, JS heap, renderer-reported resource bytes, context-loss/recovery outcome, screenshots or image-diff score, and network profile. Repeat cold/warm cache runs. Device-memory estimates must be labelled as estimates unless the platform provides measured GPU memory.

## Evidence status

### Posey County ZIP 47620 — real downloaded source evidence

- The live workflow queries the U.S. Census Bureau TIGERweb 2020 Census ZIP Code Tabulation Area for `47620` and Posey County boundary (county FIPS `18129`), then intersects the two polygons. This is more specific than the previous broad Lower Wabash–Ohio candidate rectangle.
- The generated AOI remains `UNAPPROVED`. Its WGS84 bounding box is `[-88.097892, 37.771672, -87.698872, 38.089455]`; geometry SHA-256 is `8c3fd09dad946ffbc73e125e1d61b41bc26d43c534908b4f6e2fc5c80b395a92`. The ZIP ZCTA is a statistical approximation of postal geography—not a surveyed parcel or watershed.
- USGS 3DEP returned a real 2048×2048 single-band Float32 GeoTIFF in EPSG:4326, 16,780,090 bytes, raster SHA-256 `d1362d2831fb37843d8a321e08dec7913d082ade37f313af94347f8934153cd2`. Of 1,519,977 raster pixel centers inside the clipped AOI, 1,519,977 were valid (valid fraction 1.0, NoData fraction 0.0). Observed elevation values range from 100.6999969 to 168.7513123 metres in the returned raster values. These are raster statistics, not a verified datum/accuracy assertion.
- Source evidence includes saved Census TIGERweb responses, the AOI GeoJSON, the GeoTIFF, and a provenance/coverage JSON report. The final workflow run succeeded: [Geospatial Blueprint Ops run 39938439987](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/39938439987). The artifact `posey-county-47620-terrain-evidence-30c58df94fc67561fc42f4b15ead4721249d5231` is retained until 2026-11-22.
- The raster is a resampled USGS 3DEP dynamic-mosaic screening export, not native QL2/lidar. Source-specific vertical datum, acquisition vintage, and accuracy class remain unresolved. Do not use it as an engineering-grade surface or as sole authority for hydrologic modeling.

### Implementation/CI evidence and remaining acceptance gates

- The exact-main geospatial workflow passed: Census/USGS acquisition, Transvoxel table regeneration, exhaustive Python transition cases over 3,072 signed-orientation fixtures, synthetic DEM stage 1–2 self-test, CityJSON-to-3D-Tiles self-test, and live SSE certification. The TypeScript typecheck, tile-stream tests, and Transvoxel tests also passed.
- The PR implementation for GPU H-Z and Transvoxel meshing is merged into `main`. H-Z is opt-in and has a renderer API that consumes its actual depth attachment and caller-supplied candidate bounds; it does not connect MapLibre's separate WebGL render graph to WebGPU.
- No physical GPU/device-lab outputs or browser WebGPU correctness comparison against a CPU reference have been captured. CI now emits a bounded real-DEM transition-face benchmark, but no full adaptive-octree benchmark or cross-chunk manifold proof exists. Source-specific vertical-datum/control-point validation also remains absent. Consequently physical desktop/mobile correctness and performance, full LOD seam/manifold closure, and CRS/datum accuracy acceptance remain open. Do not infer these results from software CI or the screening raster.
- Main-branch build, deployment, offline-runtime, and repository-wide CI workflows were still running when this evidence was updated; the geospatial workflow's success is not a claim that every repository release check is green.
