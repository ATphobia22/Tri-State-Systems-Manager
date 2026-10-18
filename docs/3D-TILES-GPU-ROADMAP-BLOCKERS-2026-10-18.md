# TSM 3D Asset / GPU Pipeline — Gate Status (2026-10-18)

This document distinguishes implemented work, automated tests, and architectural
blockers. A checked-in implementation is not considered verified until its
applicable CI and integration tests pass.

## 1. State-word decoding and presentation fallback

**Implementation:** the current TSM 16-bit visual-state schema is
`B[15:14] D[13:12] C[11:9] T[8:6] S[5:3] R[2:0]`. B/D store levels 0–3;
C/T/S store three-bit fields but levels 4–7 are reserved; the R field accepts
0 (normal) or 1 (exception) and rejects 2–7.

The implicit 3D Tiles builder now writes `StateWord` into the
`EXT_structural_metadata` property table associated with `EXT_mesh_features`.
The default `0x52C8` represents a **presentation-only baseline** when the source
does not explicitly provide `extras.tsm.stateWord`; it is not a surveyed fact,
a hydrologic classification, or evidence that four LODs exist.

The Three.js runtime registers the installed renderer's
`GLTFExtensionsPlugin`, reads valid state words only for single-feature meshes,
and uses measured frame rate with hysteresis to lower/restore the T texture
dimension. A low-T state disables material texture maps without deleting
geometry. Invalid or mixed-feature metadata is ignored. Component-complexity
and semantic-depth asset swapping remain unimplemented because TSM's current
building tiles do not include registered C/S resource variants or a network
resource manifest. The pure scheduler remains a plan generator; it does not
claim to have a network fetch/release engine.

**Verification:** exhaustive codec/scheduler tests, metadata-reader runtime
tests, and parser/typecheck/build CI are required for this branch.

## 2. PBR baking and texture atlas consolidation

**Implementation:** `scripts/3d-tiles/pack-atlas.py` imports multiple GLBs,
globally unwraps/packs UV islands, bakes base color, tangent-space normal,
roughness, metallic, and ambient occlusion. It packages glTF's ORM texture as
R=AO, G=roughness, B=metallic, then exports one shared PBR material with three
texture bindings: base color, normal, and ORM. Individual channel PNGs are
retained as audit artifacts. Unsupported metallic shader graphs and missing
source materials fail closed instead of silently replacing them with invented
appearance.

`tsm-console/scripts/3d-tiles/bake-pbr.py` also supports individual channel
bakes. Data maps use Non-Color and base-color/emissive maps use sRGB.

**Verification:** `scripts/3d-tiles/test_pack_atlas_blender.py` generates
fixture GLBs, runs a real headless Blender bake/export, and verifies the final
GLB embeds base-color, normal, metallic-roughness, and AO texture bindings.
`.github/workflows/pbr-atlas-validation.yml` runs this round-trip; it passed
on the TSM PR head `4132c9e6a4313e8328f1e634f6506b0118ea6eb5` on 2026-10-18.
The final branch head must still pass the same gate after all changes.

Reference: [Blender glTF 2.0 material export](https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html).

## 3. CPU and GPU frustum culling

**Status:** a conservative six-plane AABB/frustum predicate is available in
`tsm-console/src/lib/lod-scheduler.ts` for the Transvoxel LOD scheduler. It
rejects a node only when its positive support vertex is outside a frustum
plane; plane-touching bounds remain visible. Tests cover malformed planes,
boundary contact, and resident-set eviction. This is a CPU selection primitive;
the live MapLibre 3D Tiles renderer is not yet wired to pass its current camera
frustum into this Transvoxel scheduler.

GPU-compute culling remains **not implemented**. TSM uses MapLibre's custom-layer
WebGL2 context and NASA-AMMOS 3D Tiles Renderer JS. The 3D Tiles renderer
performs its own conventional visibility/frustum selection; that is not a
custom GPU compute pass. Automatic LOD adjacency construction is quadratic and
now has an explicit 5,000-node safety limit; larger octrees must supply a
precomputed adjacency map.

MapLibre documents WebGPU as a renderer backend under active graphics
modernization. A WebGPU compute pass must wait for a supported TSM renderer
backend and an integrated visibility pipeline; adding an isolated WGSL shader
inside today's WebGL2 custom layer would not be an executable feature.

Reference: [MapLibre CustomLayerInterface](https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/),
[MapLibre graphics modernization roadmap](https://maplibre.org/roadmap/maplibre-gl-js/graphics-modernization/).

## 4. Depth occlusion / hierarchical-Z

**Status: WebGL2 query-based occlusion implemented; hierarchical-Z compute is not implemented.**

`tsm-console/src/lib/webgl2-depth-occlusion.ts` uses non-blocking
`ANY_SAMPLES_PASSED_CONSERVATIVE` queries against the shared WebGL2 depth
buffer. Query results are polled only when `QUERY_RESULT_AVAILABLE` is true.
A target is suppressed after two consecutive no-sample results and restored
immediately when a sample passes. Query allocation is capped (default 2,048
tracked meshes), work is capped per frame (default 64 queries), and meshes past
the cap remain visible. Unsupported contexts and query errors fail open.

The layer registers/unregisters tile meshes with the controller, combines
occlusion visibility with StateWord-derived visibility, and resets Three.js'
state cache after raw WebGL calls. Probe tests exercise visibility hysteresis.

**Scope and remaining validation:** this is conservative, delayed WebGL2 query
occlusion against depth already present when the TSM custom layer runs. It is
not a hierarchical-Z pyramid or GPU-compute culling pass, and effectiveness
depends on layer order and prior depth-writing geometry. The current unit and
visual checks do not replace browser/device profiling across target GPUs,
context-loss testing, or proving occluder coverage for each deployment style.
Do not claim universal all-mesh occlusion or hierarchical-Z support.

References: [Three.js Object3D](https://threejs.org/docs/pages/Object3D.html),
[MDN WebGL2 query results](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/getQueryParameter),
[NASA-AMMOS 3D Tiles Renderer metadata plugin API](https://github.com/NASA-AMMOS/3DTilesRendererJS/blob/master/src/three/plugins/API.md).

## 5. Transvoxel / terrain LOD transition stitching

**Status:** not integrated into TSM's current runtime. An open-source Rust
`transvoxel` crate exists ([docs.rs](https://docs.rs/crate/transvoxel/latest);
[source](https://github.com/ling0x/transvoxel)). It implements block-level
Transvoxel meshing; the calling application remains responsible for block
neighborhoods, balanced 2:1 LOD relationships, boundary transitions, and
streaming/orchestration. It is not a drop-in browser WebGPU terrain renderer.

TSM's relevant committed runtime currently loads raster/DEM terrain and building
GLB/3D Tiles content; it does not provide a volumetric density field and balanced
voxel octree for that crate to consume. Integrating the crate without that data
model would create an unconnected demo rather than close the engineering gate.
The current canvas flood layer remains a raster-grid visualization, not
Transvoxel seam stitching.

Unblock condition: introduce an explicit voxel-density/voxel-chunk data contract
and balanced octree/neighbor scheduler, then port or call the crate through a
tested WASM adapter and validate all 2:1 transition faces. If the desired goal is
terrain made directly from DEM heightfields instead, specify a heightfield LOD
edge-stitching algorithm rather than Transvoxel.

## 6. Coordinate transforms / RTC

The HLOD builder uses an ECEF-derived local ENU frame and has numerical tests
for its basis, origin projection, inverse transform, and round-trip matrix math.
These tests do not certify input CRS, vertical datum, coordinate epoch, source
accuracy, or survey suitability. The renderer applies tile and glTF transforms;
legacy `RTC_CENTER` is not treated as a 3D Tiles 1.1 transform contract.
Coordinate/provenance and engineering review gates remain mandatory.

## 7. CI and release discipline

The IGIO acquisition step now treats incomplete live feature responses as
unavailable and uses the existing pinned snapshot only after SHA-256 and feature
count validation. The cached fallback writes the GeoJSON, checksum sidecar, and
receipt expected by the production workflow. Live endpoint availability is not
allowed to turn a zero-feature response into a successful acquisition.

The release remains gated on passing latest-head Parse/Typecheck/Geospatial CI,
production build, Building 3D Tiles acceptance, PBR Atlas Validation, desktop/
offline checks, and security scanning. A queued, cancelled, or missing workflow
run is not a pass. Do not merge or describe `main` as green until the same commit
has the required passing results.
