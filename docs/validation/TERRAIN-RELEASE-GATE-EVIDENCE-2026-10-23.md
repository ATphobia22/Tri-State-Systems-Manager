# Terrain and geospatial release-gate evidence protocol — 2026-10-23

This document separates implementation artifacts from acceptance evidence. Do not mark a gate complete because a shader compiles, a schema exists, or a workflow is queued.

## Current implementation in this change

- `webgpu-hierarchical-z.ts` builds a max-depth mip chain with WebGPU compute from a real `GPUTexture` depth attachment. Odd-size mip reduction partitions the complete source extent to retain edge samples.
- `webgpu-hierarchical-z-cull.ts` computes conservative candidate visibility on the GPU and returns `1` for visible/uncertain and `0` for occluded. Invalid and off-viewport candidates fail open.
- `TsmWebGpuRayTracer` now owns a `depth32float` attachment and exposes `renderFrameWithOcclusion()`, which renders a source-bound frame, builds the H-Z pyramid, dispatches GPU candidate classification on the same device, and returns visibility flags. This is opt-in and does not connect MapLibre's separate WebGL render graph to WebGPU. Device loss invalidates the renderer resources; the host must reacquire a device and rebind verified terrain resources.
- `validate-terrain-aoi-evidence.mjs` validates evidence supplied from real AOI geometry and source/raster inspection. It intentionally leaves unique AOI coverage null because overlapping footprints must be spatially unioned.

## GPU H-Z acceptance

1. Run a browser/WebGPU-capable integration test against the renderer's actual depth attachment.
2. Compare every GPU visibility result to a conservative CPU reference on deterministic fixtures: full occlusion, far-depth holes, near/far boundaries, off-screen rectangles, reversed/invalid bounds, NaN/Infinity, viewport resize, and odd dimensions.
3. Force device loss/context teardown; verify stale resources are never reused, the renderer degrades visibly, and a new device rebuilds pipelines and textures.
4. Benchmark baseline frustum/CPU culling against H-Z with identical camera path, draw list, resolution, and hardware. Report warm-up policy, sample count, p50/p95/p99 frame and culling times, false-occlusion count (must be zero), visible/candidate counts, GPU timestamp-query availability, and browser/driver/device versions. H-Z must remain disabled for workloads where its overhead regresses frame time.
5. Record raw machine-readable results and the commit SHA. Do not infer performance from literature or another GPU.

## Transvoxel acceptance

- The transition-cell table uses 9 independent fine-side scalar values to select one of 512 masks; 13 spatial sample positions include nine fine-side scalar samples that select the 9-bit case plus four independent coarse-side scalar samples used to interpolate edges touching the coarse face. Do not treat this as a 13-bit case table.
- Exhaustively enumerate all 512 transition case masks and validate all 56 equivalence classes against the canonical table. The Python fixture self-test covers all six signed face orientations; the TypeScript suite includes adjacent-cell boundary-intersection checks, which must pass on the exact release head.
- For every supported LOD face/orientation, emit adjacent meshes from shared scalar-field fixtures and check boundary edge pairing, manifoldness, no duplicate/degenerate triangles, consistent winding, and no cracks beyond the declared geometric tolerance.
- Include nodata, tile-edge, sign ambiguity, mixed-resolution, and neighboring-tile ordering fixtures. Hash deterministic mesh outputs.
- Run the actual mesher over a named, bounded representative AOI using source assets whose SHA-256, CRS, vertical datum, units, resolution, and acquisition vintage are recorded. Publish wall time, peak RSS, triangle/vertex counts, seam-test outcomes, and hardware/software versions.

## AOI coverage, nodata, and provider recovery

- Obtain a real AOI polygon (not only an address) and hash the canonical geometry bytes. Record horizontal CRS and the exact catalog snapshot digest.
- For each source/asset, record stable source ID/URL, acquisition date, content hash, horizontal CRS, vertical datum, epoch when applicable, units, accuracy class, footprint, measured coverage fraction, measured nodata fraction, transform pipeline/version and grid dependencies.
- Produce unique AOI coverage by spatially unioning clipped footprints, and nodata from raster masks over the AOI. Per-source coverage fractions cannot be summed to derive unique coverage.
- Test timeout, cancellation, HTTP 4xx/5xx, corrupt bytes, checksum mismatch, stale cache, offline/online transition, empty intersection, partial coverage, and alternate-provider recovery. Missing/failed sources must remain explicitly missing; never synthesize terrain.

## CRS, vertical datum, epoch, and accuracy

- Pin the supported source-catalog snapshot and run the validator against every catalog entry, not a sample.
- Report total denominator, valid numerator, skipped records, and counts by missing/invalid CRS, vertical datum, coordinate epoch, units, transformation grid/version, accuracy class, acquisition date, and content hash.
- Validate vertical transformations against an authoritative transformation service/grid and known control points. Never convert gage stage to orthometric elevation without a published station relationship; never imply survey accuracy from metadata presence.
- Store the full report, input snapshot digest, tool versions, and generated timestamp as a CI artifact.

## Cross-device matrix

At minimum, test current stable Chromium desktop on a discrete GPU, integrated-GPU laptop, and Android WebView/mobile device; include Safari/WebKit on iOS when WebGPU is supported by that exact OS/browser combination. Record unsupported combinations as unsupported, not as passed.

For each device, capture GPU adapter/features/limits, browser/OS/driver, viewport and DPR, dataset hash, warm-up frames, at least 300 measured frames, p50/p95/p99 frame time, CPU time, GPU time when timestamp queries are available, JS heap, renderer-reported resource bytes, context-loss/recovery outcome, screenshots or image-diff score, and network profile. Repeat cold/warm cache runs. Device-memory estimates must be labelled as estimates unless the platform provides measured GPU memory.

## Evidence status

- A candidate AOI polygon already exists in the repository and remains `UNAPPROVED`. Its WGS84 bounds are `[-88.05, 37.8, -87.9, 37.95]`; canonical geometry SHA-256 is `6c8a2b7b38fd47fa4a19e220c5969fd57a83026a37354834d94e9939789ac7e5`.
- A live USGS 3DEP dynamic-mosaic screening raster was acquired and hashed. The 1024×1024 EPSG:4326 GeoTIFF covers 1,048,576 rasterized AOI pixels with valid-data fraction 1.0 and NoData fraction 0.0; raster SHA-256 is `d327faab79a770dd3c5b6d4c26669b653761b5776009f4d91062761eab484f31`. This is resampled screening evidence only—not native QL2 data, a certified single vertical datum, acquisition-vintage evidence, or an accuracy statement.
- The live acquisition workflow has successfully produced a GeoTIFF + JSON artifact; it uses bounded retry for transient USGS HTTP/network errors.
- No physical GPU/device-lab outputs, reference-control dataset, verified native-resolution terrain assets, or representative-area full adaptive-mesh run have been captured. Consequently desktop/mobile GPU correctness and performance, true LOD manifold/seam closure over a representative AOI, and CRS/datum accuracy acceptance remain open. Do not infer these results from CI table tests or the screening raster.
