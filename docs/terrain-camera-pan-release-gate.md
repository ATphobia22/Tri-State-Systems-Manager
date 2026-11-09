# Mount Vernon terrain camera-pan release gate

## Execute synthetic contract test
```sh
node --test tests/contracts/terrain-camera-pan-benchmark.test.mjs
node tests/contracts/terrain-camera-pan-benchmark.test.mjs --report > camera-pan-synthetic.json
```

The harness tests SSE-driven selection and 2:1 face-neighbor balance on a **synthetic octree**. It does not yet call the production TransvoxelStitcher or validate actual 3DEP terrain. The distance used in this harness is distance to the node AABB, whereas the existing LiveSSEEvaluator uses distance to the tile center. These must be reconciled when wiring the production adapter.

## Required release-grade integration
1. Record exact main SHA, platform, renderer, GPU, driver, viewport, FOV and run timestamp.
2. Acquire official USGS 3DEP DEM and record source URL, acquisition time, CRS, vertical datum, units, SHA-256 and license. Do not infer NAVD88 from filenames.
3. Build SDF octree and enforce 2:1 balance after SSE refinement and before mesh generation.
4. Invoke actual production TransvoxelStitcher on every transition face, including corner-case permutations, using canonical coarse/fine sampling.
5. Export world-space seam intersections from adjacent meshes; compare coordinates with explicit metric tolerance and count gaps, overlapping triangles, non-manifold edges, and inverted faces.
6. Run a headed camera path with identical deterministic camera poses; capture screenshots and GPU frame times, frame hashes, device/driver, peak VRAM and LOD churn.
7. Repeat with near-iso DEM values, camera reversals, and terrain edge boundaries; compare results across runs.
8. Store large raw DEM, mesh, screenshots and logs in Google Drive folder https://drive.google.com/drive/folders/1EZPN7xvWt4ZyaQDkUfHXNdG0lXtLJFF7; commit only small SHA-256 manifests and evidence pointers to Git.
9. Report gate as NOT_EVIDENCED until actual DEM, real transition geometry, headed GPU capture, and reproducibility records are attached.

## Acceptance thresholds (proposed; require review)
- 0 unbalanced adjacent face pairs; 0 unexpected gaps and triangle overlaps; 0 invalid/non-finite seam vertices.
- Seam tolerance must be specified in source CRS metric units, and justified against DEM resolution and numerical precision.
- No claim of 60 FPS or a particular VRAM budget without target hardware and actual headed measurements.

## Storage boundary
Google Drive is an artifact/archive location, not a substitute for a local offline runtime bundle. Shipping Windows builds must stage their validated terrain snapshots locally, with checksum verification and no runtime dependency on Drive.
