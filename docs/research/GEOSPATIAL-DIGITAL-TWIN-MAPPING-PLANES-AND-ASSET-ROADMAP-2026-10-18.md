# Geospatial digital-twin mapping planes and asset finalization: applicability to TSM

**Status:** research and implementation roadmap; not a claim that every proposed feature exists in TSM or is already implemented.  
**Review date:** 2026-10-18  
**Decision:** align asset finalization with TSM's existing application LOD contract, OGC 3D Tiles 1.1 pipeline, MapLibre GL JS primary renderer and optional separate WebGPU presentation renderer. Adopt the standards-grounded concepts (CRS/provenance, multi-resolution delivery, separate geometry and semantics, measured asset budgets) as design guidance. Treat the 5D B-D-C-T-S state word as an optional research-derived extension requiring a TSM-specific fit assessment and tests before implementation. Do not introduce a parallel renderer or tile protocol solely because the paper describes one.

## 0. Existing TSM architecture verified in repository contracts

Repository documents already establish relevant foundations:

- `docs/TSM-LOD-CONTRACT.md` and `contracts/tsm-lod-contract-v1.json` define an **application-level** LOD contract, including provenance, deterministic derivation, fail-closed behavior, and OGC 3D Tiles 1.1 output. Its LOD4 label means application integration with flood/hydrology data; it is explicitly **not** CityGML LOD4 or indoor modeling.
- `docs/WEBGPU-PRESENTATION-CONTRACT.md` identifies MapLibre GL JS as the primary browser renderer and WebGPU as an optional separate presentation renderer. WebGPU does not silently become a MapLibre custom layer. It requires caller-supplied, provenance-hashed terrain inputs and falls back to MapLibre/WebGL when unavailable.
- Repository code search finds existing 3D Tiles/LOD/geometric-error assets, including `scripts/geospatial/build-hlod-tileset.py`. A code search for the literal term `state-word` did not find an existing B-D-C-T-S implementation.

**Consequence:** this is not a greenfield 3D architecture. The next engineering step is a contract/code-level gap analysis against existing asset generation, validation, manifest and renderer behavior. Do not reimplement existing 3D Tiles or WebGPU contracts. The paper's 5D scheduler remains a candidate extension, not a proven missing dependency.

## 1. Executive findings

The supplied architecture text combines three different evidence classes that must not be conflated:

1. **Normative or standards-based concepts:** CityGML 3.0 conceptual modelling and LOD0–LOD3; OGC 3D Tiles 1.1 hierarchical tile refinement, geometric error, transforms, bounding volumes and metadata; glTF 2.0 asset/material conventions; coordinate-reference-system transformations.
2. **A published, evaluated research proposal:** Zhang et al.'s 2026 B-D-C-T-S five-dimensional decoupling and 16-bit state-word scheduling method. It is a paper's proposed framework, not an OGC standard.
3. **Engineering hypotheses and targets:** the L1–L5 integration tiers, S0–S6 spatial tiers, B/D/C/T/S memory estimates, custom LOD sub-tiers such as LOD2.3, universal VRAM-savings targets, sub-millimeter stability guarantees, single-draw-call claims, automated AI reconstruction claims, and zero-CPU-overhead claims. These must not be represented as standardized requirements or verified outcomes without independent evidence and reproducible TSM benchmarks.

## 2. Verified standards and research

### CityGML 3.0

CityGML 3.0 defines a conceptual information model for 3D city and landscape objects. It is not limited to one file encoding; implementations can map the conceptual model to supported encodings and database schemas. The standard defines four geometric LODs, LOD0–LOD3. LOD4 was removed: indoor and outdoor representations can be assigned within LOD0–LOD3, and geometric LOD is no longer a proxy for semantic decomposition. Different representations can coexist for the same feature.

**Implementation consequence:** preserve feature identity, semantics, topology/provenance and geometry representation as related but distinct concerns. Do not hard-code the supplied LOD0.0/0.3 through LOD3.3 subtiers or their positional-accuracy values as CityGML requirements; those tables are not the normative CityGML LOD taxonomy.

Source: [OGC CityGML 3.0 Conceptual Model](https://docs.ogc.org/is/20-010/20-010.html) · [OGC CityGML guide](https://docs.ogc.org/guides/20-066.html) · [OGC CityGML standard overview](https://www.ogc.org/standards/citygml/).

### OGC 3D Tiles 1.1

3D Tiles is an open standard for streaming massive heterogeneous 3D geospatial datasets. Its hierarchical tile tree uses each tile's non-negative `geometricError` in meters to calculate view-dependent screen-space error (SSE) in pixels. Client implementations compare the resulting SSE to an application-configured maximum and refine to child tiles as needed. The specification also defines transforms, bounding volumes, content and metadata. The precise selection and scheduling policy remains implementation-dependent.

**Implementation consequence:** if TSM actually needs tiled 3D city/BIM content, prefer interoperable 3D Tiles and glTF capabilities before inventing a parallel tile protocol. Keep tile refinement distinct from independent choices about texture quality, component visibility and semantic payload. A single geometric SSE threshold does not by itself implement the paper's five-dimensional scheduler.

Source: [OGC 3D Tiles 1.1 specification](https://docs.ogc.org/cs/22-025r4/22-025r4.html).

### Published B-D-C-T-S proposal

Zhang, Shi, Jiang, Lyu and Shi, “A 5D Orthogonal Decoupling Framework and 16-Bit State-Word-Driven Scheduling Method for 3D Building Models in WebGIS,” *ISPRS International Journal of Geo-Information* 15(5), 215, published 19 May 2026, DOI [10.3390/ijgi15050215](https://doi.org/10.3390/ijgi15050215). The paper proposes separately schedulable dimensions for Boundary-based Spatial Proxy, Geometric Detail, Component Complexity, Texture Appearance and Semantic Information.

The paper reports, under its tested datasets and settings, a 93.1% reduction in first-screen requested payload versus monolithic loading, an approximately 144-fold speedup for C-field extraction versus JSON deserialization and lookup, and a 44.1% reduction in semantic payload in its Home Tile test. It also reports a 1.12 GB first-screen memory test with 22.7 MB of physical payload loaded under its D1 tile scheduling condition and approximately 88.1 MB resident memory. These are **study-specific reported measurements**, not general guarantees or measured TSM results. The reported evaluation uses a single-building BIM model and an urban-scale photogrammetric mesh dataset; it does not establish that the same gains will transfer to TSM's workflows, renderer, data or user devices.

Source: [Full open-access paper](https://www.mdpi.com/2220-9964/15/5/215).

## 3. State-word design review

The proposed bit allocation is arithmetically consistent: B uses 4 bits and D/C/T/S use 3 bits each, for 16 total bits. That only establishes encoding capacity, not correctness of the state machine.

Before adopting it, define and test:

- The valid enum values for each field and the handling of all unused bit patterns. In particular, a 4-bit B field can encode 16 values although the described B levels only enumerate B0–B3; each 3-bit field can encode eight values while the prose describes only levels 0–3.
- A versioned state-word schema and explicit masks/shifts, including endianness/serialization rules if the value crosses process or network boundaries.
- A canonical legality predicate for combinations. Metadata without a valid feature identity/locatable carrier and components without a compatible host representation should be rejected or normalized deterministically; do not rely on undocumented implicit constraints.
- A degradation order with invariant preservation: keep stable feature identity and required safety/engineering semantics while lowering optional visual detail. Rendering quality can degrade; authoritative hydraulic, terrain, coordinate, provenance and uncertainty data must not silently be discarded or confused with presentation assets.
- Exhaustive tests for encode/decode round trips, invalid states, transition diffs, fallback determinism and backward compatibility. Benchmark the decoder against a baseline in the actual TSM runtime before claiming performance benefits.

A 16-bit word is suitable only if the valid state model fits the chosen fields. Do not pack the entire dynamic semantic graph or live sensor payload into this word; use it as a compact state descriptor that references separately versioned resources.

## 4. CRS and numerical precision

EPSG:4326 is a geographic CRS whose horizontal coordinates are angular degrees, not local metric coordinates. UTM is a projected metric CRS whose appropriate zone/datum must be selected for the AOI. ECEF (for example, EPSG:4978) and local ENU/tangent frames serve different purposes and must not be interchanged without a defined transform pipeline.

Large global coordinates represented in 32-bit floating point can lose local precision. A local origin or relative-to-center strategy can reduce the magnitude of vertex coordinates used by rendering, but **does not guarantee sub-millimeter accuracy by itself**. The transform chain must preserve the source CRS, datum/epoch where relevant, vertical datum, axis order, units, and georeferencing provenance. Keep authoritative source coordinates in a suitable precision and apply a reversible, tested transform to renderer-local coordinates.

For a 3D Tiles 1.1 path, follow its tile and glTF transform rules and the current specification; do not blindly copy legacy `RTC_CENTER` examples from older 3D Tiles 1.0 content into a 1.1 pipeline. Add test fixtures with known control points and round-trip tolerances appropriate to the source data and use case.

## 5. Materials, topology and rendering claims

- glTF 2.0 metallic-roughness PBR is a supported material model; not every asset needs all possible texture maps. Bake and atlas only where source assets, UVs, licensing and target renderer justify it.
- Texture atlasing can reduce material switches and draw calls in compatible batches, but it does **not** guarantee one draw call for an entire city or district. Geometry partitions, transparency, material differences, culling, feature picking and tile boundaries still matter.
- Mesh repair is not a blind “make everything manifold” operation: some valid GIS surfaces are open surfaces, and repair/decimation can change dimensions or topology. Preserve originals, record each transformation, run geometry validation and compare bounds/area/volume and control points against tolerances.
- LOD-aware mipmaps and texture budgets are useful, but memory cost depends on texture dimensions, formats, compression, mip levels, residency and renderer behavior. The prompt's per-entity VRAM figures are not universal constants.
- WebGPU supports compute-oriented GPU work where the browser, adapter and renderer support the required features. It does not guarantee zero CPU overhead or a portable ability to query exact free VRAM. Treat GPU culling, indirect draws, SDF terrain and Transvoxel stitching as separate advanced workstreams requiring feature detection, fallback paths and device-level benchmarks.
- Transvoxel is a specific transition-cell approach for stitching voxel terrain at differing resolutions; it is not an OGC requirement and does not solve arbitrary mesh topology or all geospatial terrain seams automatically.

## 6. TSM asset finalization roadmap

### Phase 0 — Inventory and scope gate
- Compare `docs/TSM-LOD-CONTRACT.md`, `contracts/tsm-lod-contract-v1.json`, `docs/WEBGPU-PRESENTATION-CONTRACT.md`, `scripts/geospatial/build-hlod-tileset.py`, the tileset validator and current asset manifests as one release path.
- Trace coordinate transforms from source CRS through tile transforms and renderer-local coordinates; verify horizontal CRS, vertical datum, axis order, units and provenance at each boundary.
- Verify which parts of LOD1/LOD2/LOD3 and WebGPU presentation are implemented and test-covered versus contract-only or data-gated. Avoid treating planned items as shipped functionality.

**Exit criteria:** documented current-state inventory and an approved, bounded use case with representative datasets.

### Phase 1 — Interoperable spatial asset contract
- Define a versioned asset manifest: stable feature ID, source URL/identifier, license/attribution, capture and processing dates, horizontal CRS, vertical datum, units, transforms, bounds, LOD/geometry type, asset MIME type, checksums, quality flags and provenance.
- Keep analytical terrain, water, flood-model inputs, model outputs, visualization meshes, textures and descriptive metadata as distinct resource types.
- Validate CRS and vertical datum explicitly; reject unknown or mismatched CRS rather than guessing.
- Add small fixtures for CityGML/3D Tiles/glTF only if those formats are actually in scope.

**Exit criteria:** schema validation, deterministic parsing, provenance and coordinate round-trip tests.

### Phase 2 — Geometry and material pipeline
- Build an optional, headless Python/Blender preprocessing path only for formats TSM must ingest.
- Make each transform deterministic and logged; preserve originals and checksums; validate normals, winding, degenerate faces, bounds, coordinate transforms and topology against format-appropriate rules.
- Add PBR baking/atlasing as an opt-in optimization, with texture-compression and memory budgets. Preserve a simple material fallback.
- Avoid automated geometry repair that changes authoritative terrain or engineering surfaces without an explicit tolerance and review.

**Exit criteria:** fixture-based QA report, reproducible outputs, bounded asset sizes and no unreviewed geometry drift.

### Phase 3 — Progressive delivery and state scheduling
- Keep OGC 3D Tiles 1.1 hierarchical refinement and the existing TSM LOD contract as the baseline.
- Only prototype B-D-C-T-S as a compatible extension if independent texture/component/semantic scheduling addresses a measured bottleneck that standard tiling and the current renderer do not solve.
- Define a legal-state table, versioned 16-bit encoding, degradation priorities and telemetry. If the 16-bit schema cannot express future states safely, version the schema rather than reinterpret existing bits.
- Use graceful fallbacks for low bandwidth, memory pressure, WebGPU absence and mobile hardware. Do not require unsupported VRAM introspection.

**Exit criteria:** parity tests for feature identity and semantics across LOD changes; stress tests for cancellation, retry, partial failure and memory-pressure fallback.

### Phase 4 — Optional volumetric terrain research
- Keep SDF/voxel terrain, GPU compute meshing and Transvoxel behind a separate prototype boundary.
- Compare against the existing DEM/TIN/terrain-tile pipeline for accuracy, startup time, memory, seam artifacts and device compatibility.
- Do not replace established hydrology terrain inputs with a renderer-specific volumetric surface. Analytical source data and visual meshes must remain separately traceable.

**Exit criteria:** reproducible benchmarks across representative GPUs and terrain datasets, verified seam behavior, fallback support and a documented reason to ship.

### Phase 5 — Release gates and operational ownership
- Add schema and asset-manifest validation, dependency/security scans, geometry fixture tests, deterministic build/provenance checks, bundle-size budgets and browser/device smoke tests.
- Publish benchmark methodology and raw measurements. Compare before/after results using the same devices, datasets, camera paths and cache state.
- Do not use aspirational thresholds (e.g. 50% VRAM reduction, 80% less manual labor, sub-millimeter rendering stability) as release criteria until TSM has established a measured baseline and an approved acceptance method.

## 7. Recommended immediate actions

1. Add this research note and cite the primary standards and paper.
2. Run a focused repository inventory before introducing any renderer or 16-bit decoder; record evidence and existing implementation gaps.
3. Add a CRS/provenance/asset-manifest contract only where it aligns with the current data model.
4. If 3D Tiles is already used or explicitly approved, add a tiny conformance fixture and a tested local-coordinate transform path.
5. Keep the 5D scheduler, PBR baking, AI LOD2/LOD3 reconstruction and WebGPU volumetric terrain as separate proposals until a TSM benchmark justifies each one.

## Sources

- OGC, [CityGML 3.0 Conceptual Model Standard](https://docs.ogc.org/is/20-010/20-010.html).
- OGC, [CityGML 3.0 guide](https://docs.ogc.org/guides/20-066.html).
- OGC, [3D Tiles 1.1 specification](https://docs.ogc.org/cs/22-025r4/22-025r4.html).
- Khronos Group, [glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).
- Zhang, T.; Shi, Y.; Jiang, W.; Lyu, C.; Shi, S. (2026), [A 5D Orthogonal Decoupling Framework and 16-Bit State-Word-Driven Scheduling Method for 3D Building Models in WebGIS](https://doi.org/10.3390/ijgi15050215), *ISPRS International Journal of Geo-Information*, 15(5), 215.
- W3C, [WebGPU specification](https://www.w3.org/TR/webgpu/).
- Transvoxel, [algorithm overview and reference implementation](https://transvoxel.org/).

**Scope note:** This document is research guidance, not an implementation attestation. It does not assert that TSM currently contains CityGML/3D Tiles/WebGPU pipelines, that the paper's benchmarks reproduce in TSM, or that any asset is suitable for hydraulic/flood engineering without independent data validation and review.
