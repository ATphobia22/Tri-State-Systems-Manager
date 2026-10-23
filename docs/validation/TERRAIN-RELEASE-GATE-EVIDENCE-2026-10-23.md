# Terrain and geospatial release-gate evidence protocol — 2026-10-23

This document separates implementation artifacts from acceptance evidence. Do not mark a gate complete because a shader compiles, a schema exists, or a workflow is queued.

## Current implementation in this change

- `webgpu-hierarchical-z.ts` builds a max-depth mip chain with WebGPU compute from a real `GPUTexture` depth attachment. Odd-size mip reduction partitions the complete source extent to retain edge samples.
- `webgpu-hierarchical-z-cull.ts` computes conservative candidate visibility on the GPU and returns `1` for visible/uncertain and `0` for occluded. Invalid and off-viewport candidates fail open.
- Both GPU modules are primitives, not a claim that MapLibre or the production renderer is wired to a WebGPU depth attachment. The renderer must supply its actual depth texture and screen-space candidate bounds. Device loss is terminal for a builder/culler instance; the host must acquire a replacement device and recreate resources.
- `validate-terrain-aoi-evidence.mjs` validates evidence supplied from real AOI geometry and source/raster inspection. It intentionally leaves unique AOI coverage null because overlapping footprints must be spatially unioned.

## GPU H-Z acceptance

1. Run a browser/WebGPU-capable integration test against the renderer's actual depth attachment.
2. Compare every GPU visibility result to a conservative CPU reference on deterministic fixtures: full occlusion, far-depth holes, near/far boundaries, off-screen rectangles, reversed/invalid bounds, NaN/Infinity, viewport resize, and odd dimensions.
3. Force device loss/context teardown; verify stale resources are never reused, the renderer degrades visibly, and a new device rebuilds pipelines and textures.
4. Benchmark baseline frustum/CPU culling against H-Z with identical camera path, draw list, resolution, and hardware. Report warm-up policy, sample count, p50/p95/p99 frame and culling times, false-occlusion count (must be zero), visible/candidate counts, GPU timestamp-query availability, and browser/driver/device versions. H-Z must remain disabled for workloads where its overhead regresses frame time.
5. Record raw machine-readable results and the commit SHA. Do not infer performance from literature or another GPU.

## Transvoxel acceptance

- Exhaustively enumerate all 512 transition case masks and validate all 56 equivalence classes against the canonical table.
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

No AOI polygon, terrain catalog snapshot, source raster hashes, reference-control dataset, or physical device-lab outputs were supplied in this task. Consequently this change can add implementation and validation infrastructure, but cannot truthfully generate a verified representative-area result or cross-device performance measurements. Those acceptance gates stay open until evidence is captured and reviewed.
