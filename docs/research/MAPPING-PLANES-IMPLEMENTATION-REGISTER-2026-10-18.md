# Mapping planes: implementation and release register

**Review date:** 2026-10-18  
**Scope:** TSM's four-plane application architecture, spatial/3D asset planes, and the residential hydrology AOI pipeline.  
**Status:** Consolidated implementation register; individual rows stay open until a named test or evidence artifact proves closure.

This register turns the existing architecture and mapping-plane research into verifiable release gates. It does not declare the whole mapping stack complete just because a schema validates or a CI job passes.

## 1. Keep three models separate

1. **TSM application planes** are the four owners defined by ADR-005 in `data/schemas/tsm-four-plane-architecture-v1.json`: Evidence & Data Governance; Scientific & Simulation; Governance & Decision; and Public Experience / Visualization. `docs/FOUR-PLANE-ARCHITECTURE.md` is a rendering of that canonical JSON.
2. **Spatial asset organization** uses CRS-aware geometry, source identity, bounding volumes, glTF content, and OGC 3D Tiles 1.1 hierarchies. It is not the same as the application-plane architecture.
3. **B-D-C-T-S** (Boundary proxy, Geometric detail, Component complexity, Texture appearance, Semantic information) is the optional research-derived five-dimensional scheduling proposal described in the 2026 paper cited in `docs/research/GEOSPATIAL-DIGITAL-TWIN-MAPPING-PLANES-AND-ASSET-ROADMAP-2026-10-18.md`. It is not an OGC requirement, is not currently established as a TSM state-word contract, and must not be introduced as a second tile protocol without a measured need.

TSM's application LOD4 is hydrology/flood-data integration; it is **not** CityGML LOD4. CityGML 3.0 uses LOD0–LOD3. Never let labels from these separate models leak into each other.

## 2. Plane-by-plane acceptance matrix

| Plane | Canonical ownership | Existing repository evidence | Release acceptance |
|---|---|---|---|
| **1 — Evidence & Data Governance** | Source acquisition, immutable inputs, provenance, freshness, hashes, source validation | `docs/TSM-DATA-PLANE-INTEGRATION.md`, source registries, acquisition manifests, `scripts/ci/validate-provenance-plane.mjs`, artifact manifests | Every published data value traces to a source product/version, retrieval record, source hash, CRS/units/datum, transformation history, and validation receipt. Missing or failed sources remain MISSING/INVALID/PENDING; they never become empty-data success. |
| **2 — Scientific & Simulation** | Versioned model inputs, transformations, uncertainty, derived geometry, model adapters | `docs/architecture/HYDROLOGY-DATA-FABRIC-READINESS.md`, HEC run schemas, HEC adapters and validators, spatial scripts | Inputs, units, horizontal CRS, vertical datum, boundaries, model/version, and hashes are explicit. A valid archive alone does not make a model executable. The pipeline blocks on missing terrain, outlet, datum, boundary conditions, required review, or adapter evidence. |
| **3 — Governance & Decision** | Jurisdiction policy, human approvals, decision records, intended use, auditability | `docs/FOUR-PLANE-ARCHITECTURE.md`, `docs/hydrology/HYDROLOGY-RELEASE-CONTRACT.md`, AOI and HEC readiness manifests | Any approval is named, dated, scoped to an intended use, and bound to exact evidence/configuration hashes. A hash proves byte identity, not correctness, admissibility, survey status, or agency approval. AI output never becomes a regulatory determination by display or persistence. |
| **4 — Public Experience / Visualization** | MapLibre and optional WebGPU/R3F clients, 2D/3D terrain, maps, accessibility, provenance display | `docs/WEBGPU-PRESENTATION-CONTRACT.md`, `docs/TSM-LOD-CONTRACT.md`, `docs/3d-tiles-hlod-pipeline.md`, `tsm-console/` | The UI exposes the source/vintage, derived/authoritative status, uncertainty and data gaps. MapLibre remains primary; WebGPU is optional. 3D outputs pass strict TSM validation and the pinned OGC/Cesium/glTF validators. View-dependent quality claims require measured camera-path tests. |

## 3. Cross-cutting spatial asset layers

| Asset concern | Contractual meaning | Gate |
|---|---|---|
| **Boundary / spatial proxy** | Source bounds, coordinate reference system, transforms, extents, tile bounds | Validate finite coordinates/transforms, conservative bounding volumes, CRS lineage, units, and spatial coverage. EPSG:4326 degrees are never treated as meters. Horizontal CRS and vertical datum are separate fields. |
| **Geometric detail** | Source mesh/footprint/height, simplification history, geometric error, discrete LOD | Each simplification level identifies its source, transformation and error method. A depth-derived number is a refinement heuristic, not evidence of measured simplification error. Preserve source errors and test parent/child metadata consistency. |
| **Component complexity** | Feature grouping, content partition, stitched leaf tiles, mesh/primitive counts | Record source-feature identity and every many-to-one stitch mapping. Check duplicate/orphan IDs and GLBs. Claim request/draw-call improvements only from reproducible browser or renderer measurements. |
| **Texture appearance** | Materials, textures, atlas decisions, decode/transcode formats | Preserve source/material lineage and fallback behavior. Atlasing or compression is not automatically a one-draw-call guarantee; benchmark quality, payload size and GPU/CPU cost. |
| **Semantic information** | Stable object IDs, attributes, authority class, lineage, queryability | Semantics remain separable from visual mesh/material payload. Reject fake hashes, invented IDs, missing source links and values whose authority class is not explicit. |

These concerns can be layered on OGC 3D Tiles and glTF. They are not new normative LODs and do not justify creating an independent scheduler until a benchmark demonstrates a gap in the existing tile client.

## 4. Current implementation work and closure state

### MAP-01 — HLOD geometric-error consistency
**State: implementation and unit regression added in this branch; renderer behavior still requires production validation.**

- `scripts/geospatial/build-hlod-tileset.py` now rejects malformed, Boolean, negative, non-finite or non-numeric source geometric errors.
- The root baseline includes the maximum declared error in source descendants. Each generated hierarchy node uses the depth baseline bounded below by the maximum declared error in that node's source subtree, so a parent value cannot fall below a declared descendant value.
- Output extras explicitly identify the policy as `max-root-depth-baseline-and-source-descendant-error-v1` and label it `REFINEMENT_HEURISTIC_NOT_MEASURED_SIMPLIFICATION_ERROR`.
- `scripts/geospatial/test-hlod-tileset.py` supplies a small end-to-end CLI fixture and invalid-input tests. It is wired to the standard CI and 3D Tiles workflow.
- **Not closed by those tests:** the values have not thereby become measured simplification error. The 3D Tiles build must pass the OGC/Cesium validator, and a representative camera-path test must verify useful far/mid/near rendering and requests. Keep performance or accuracy claims blocked until this is evidenced.

### MAP-02 — Spatial hierarchy versus true multi-resolution HLOD
**State: follow-up validation required.**

The current pipeline partitions and stitches building tiles into spatial leaf content. A spatial hierarchy by itself does not prove that coarse proxy representations exist at each level. Before describing the result as view-dependent geometric simplification, capture the generated hierarchy and verify what content exists at each level, which refinement strategy is used, and what the target client renders when parent nodes have no content. Add measured LOD proxies only if they are derived from source geometry, traceable, and tested; do not synthesize survey-quality or engineering geometry from bounding boxes.

### MAP-03 — Reproducible native Rust dependency graph
**State: release-risk open.**

The Windows offline-runtime workflow currently generates `tsm-console/src-tauri/Cargo.lock` in CI, vendors dependencies, checks offline metadata, builds Tauri, and places the lockfile into the packaged runtime. This has now passed on the merged commit, but the lockfile is not committed in the source tree. Release hardening should add a lockfile generated by a controlled Cargo environment, review it, run `cargo metadata --locked` and the offline native build against that committed lockfile, and remove lockfile generation from the release build. Do not hand-author or fabricate transitive Cargo resolution data.

### MAP-04 — Site AOI evidence package
**State: candidate / not approved.**

The recorded site package for 13101 Bonebank Road explicitly labels the parcel and structure as candidates. The available record includes an IGIO parcel candidate, a single interpolated USGS EPQS centroid value, and an NFHL centroid intersection whose `STATIC_BFE` is `-9999` and normalized value is null. These facts do not establish a site DEM, surveyed elevation, parcel-wide flood-zone percentage, base flood elevation, receiving outlet, delineated catchment, or HEC model domain. Keep HEC-HMS/HEC-RAS execution blocked until current terrain coverage and metadata, effective FEMA/state map review, outlet evidence, separate catchment geometry, datum reconciliation, model boundary conditions and named human approval are recorded.

Required separate geometries when evidence becomes available: parcel, structure footprint, hydrologic catchment, and hydraulic model domain. Never copy parcel geometry into catchment/model-domain slots.

### MAP-05 — B-D-C-T-S scheduler decision
**State: research only.**

Do not implement a 16-bit state-word encoder until the application defines versioned bit meanings, permitted states, fallbacks, round-trip tests and interoperability expectations, and a benchmark shows measurable value beyond current 3D Tiles refinement plus independent material/component/semantic controls. A paper result is not a normative requirement and is not a TSM benchmark.

### MAP-06 — Renderer and artifact release evidence
**State: partially verified.**

The merge commit for PR #275 is `6516528cd8ca7be28d965c9112a038df071ec54f`. The Windows x64 offline-runtime workflow completed successfully, generated checksum/runtime manifests, and uploaded artifact `TSM-OFFLINE-RUNTIME-WINDOWS-X64-e28a90e2b97d7354b61e2bed7eafd5fe85043f23` (artifact ID `12124805594`; SHA-256 `3df98006ccfb989b4fda9a03f49a9fe4f7cec2735d23a54ff255b403fdfc1ebf)). The artifact expires on 2026-11-17. This proves that workflow's build and packaging path for that commit; it does not prove visual HLOD correctness, site-model readiness, or a committed Rust lockfile.

## 5. Definition of done

A mapping plane is not complete until each applicable criterion is backed by committed code, machine-readable provenance, and a passing automated or reviewed gate.

- [ ] Plane interfaces point to one canonical contract; docs and implementation do not duplicate conflicting definitions.
- [ ] Source and derivative artifacts retain immutable identity, hashes, native CRS/vertical datum, transformation lineage, vintage and missing-data state.
- [ ] Spatial assets pass structural validation, content/identity closure, and independent OGC 3D Tiles plus glTF validation.
- [ ] HLOD geometric-error metadata has an explicit derivation policy; renderer refinement is tested on a fixture plus representative camera paths.
- [ ] B-D-C-T-S remains explicitly optional until implementation requirements and benchmark evidence are approved.
- [ ] Native runtime resolves from a committed reviewed lockfile in offline mode.
- [ ] AOI parcel, structure, catchment and hydraulic domain remain distinct; unverified outlet/terrain/datum/boundaries block model execution.
- [ ] Human approval is tied to declared intended use and exact input hashes before any engineering/model release.
- [ ] Main branch release status is taken from the actual workflows/checks for the current `main` SHA. Missing checks are unknown, not green.

## 6. Primary contracts and research

- [OGC 3D Tiles 1.1 Specification](https://docs.ogc.org/cs/22-025r4/22-025r4.html) — tile geometric error and SSE/refinement semantics.
- [OGC CityGML 3.0 Conceptual Model](https://docs.ogc.org/is/20-010/20-010.html) — standard geometric LOD taxonomy.
- [USGS 3DEP](https://www.usgs.gov/3d-elevation-program) and [USGS 3DHP](https://www.usgs.gov/3d-hydrography-program/access-3dhp-data-products) — terrain/hydrography source discovery.
- [FEMA Map Service Center](https://msc.fema.gov/portal/home) and [FEMA NFHL service](https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer) — effective flood mapping review.
- [NOAA Atlas 14](https://hdsc.nws.noaa.gov/pfds/) — precipitation frequency inputs.
- [HEC-HMS](https://www.hec.usace.army.mil/software/hec-hms/) and [HEC-RAS](https://www.hec.usace.army.mil/software/hec-ras/) — model adapters and documentation.

**Release rule:** the register is an audit instrument, not an approval. Its unresolved rows remain release blockers for the claims they govern.
