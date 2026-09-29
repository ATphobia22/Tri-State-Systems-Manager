# TSM Native Engineering Masterclass — Ecosystem Expansion Roadmap

## Objective

Build a native, offline-capable engineering digital twin that combines photorealistic open-world interaction, scientific computation, precise geometry, evidence provenance, and artifact generation without turning third-party repositories into an uncontrolled dependency graph.

## 1. Engineering Design IR

Extend `FTSMDesignIR` into a versioned artifact contract:

- design ID and revision
- coordinate reference system
- vertical datum
- units
- geometry references
- named parameters
- feature-tree nodes
- simulation tags
- material records
- evidence references
- source hashes
- uncertainty
- validation status
- construction/design status

OpenCAD's versioned design-artifact pattern is a strong model: feature trees, named parameters, and simulation tags should be represented independently of any CAD engine.

## 2. Geometry kernel boundary

Create:

`TSMDesignIR -> OCCT/OpenCAD worker -> STEP/STL/IGES -> validation -> evidence manifest`

Requirements:

- deterministic builds
- topology/shape validity checks
- unit and datum validation
- source/design hashes
- no silent analytic fallback for deliverable CAD
- explicit `conceptual` vs `fabrication-ready` status

## 3. USD scene spine

Create a TSM USD schema layer for:

- terrain
- parcels
- buildings
- roads
- bridges
- levees
- berms
- flood surfaces
- water volumes
- measurement annotations
- evidence objects
- cameras/lights
- engineering metadata

USD becomes the exchange representation, not the authoritative data store.

## 4. Terrain interrogation fabric

Add:

- DEM sampling
- local slope/aspect
- profile extraction
- cross-sections
- contour generation
- cut/fill surfaces
- watershed/drainage analysis
- terrain-change comparison
- point-cloud inspection
- uncertainty-aware interpolation

BlenderGIS provides useful reference patterns for GeoTIFF/DEM, vector import, OSM data, georeferencing, triangulation, terrain analysis, and geotagged cameras. Its GPL boundary argues for adapter/preprocessing use rather than embedding.

## 5. Flood simulation fabric

Maintain strict separation:

### Evidence

Effective/regulatory/observed source surfaces.

### Engineering model

HEC-RAS, HEC-GeoRAS-derived preprocessing, MODFLOW, OpenFOAM, or other validated solver results.

### Presentation

Cinematic water rendering.

Never allow presentation parameters to modify engineering state.

No invented 100-year/500-year multipliers.

## 6. Numerical acceleration

Create a numerical adapter capable of:

- vector/matrix operations
- least-squares fitting
- optimization
- interpolation
- uncertainty propagation
- calibration
- sensitivity analysis

OpenBLAS supplies optimized BLAS/LAPACK primitives; it should sit beneath a TSM numerical contract rather than being exposed directly to gameplay code. urlOpenBLAShttps://github.com/OpenMathLib/OpenBLAS

## 7. Computer-vision inspection

OpenCV adapter:

- camera calibration
- feature matching
- image registration
- terrain/photo alignment
- object measurements
- photogrammetric QA
- visual anomaly detection
- evidence-image hashing

CV results remain observational/screening evidence unless tied to an authoritative engineering source.

## 8. Transportation and infrastructure

OSRM adapter:

- nearest road
- route
- travel-time matrix
- GPS/map matching
- trip optimization
- routing tiles

Use it for access, emergency routing, construction logistics, and infrastructure context—not regulatory transportation determinations. urlOSRMhttps://github.com/Project-OSRM/osrm-backend

## 9. Cinematic engineering system

Create a deterministic render recipe:

`Scenario + EvidenceManifest + DesignIR + CameraPreset + LightingPreset + WeatherPreset + RenderSettings`

The recipe produces:

- engineering inspection shots
- site overview
- flood progression
- berm/road profile
- cross-section
- before/after
- construction sequence
- grant-document figures
- briefing video

Natron/OpenFX/OpenShot remain offline finishing tools, not native runtime dependencies. Natron's node-graph, floating-point linear workflow, OpenColorIO, OpenFX, and headless rendering are particularly useful patterns. urlNatronhttps://github.com/NatronGitHub/Natron

## 10. AI/world-model boundary

OpenWorldLib suggests a future perception/reasoning fabric:

`World Observation -> Perception -> Spatial Representation -> Reasoning -> Suggested Action`

But the model may **suggest**:

- candidate terrain features
- object classifications
- possible infrastructure relationships
- scene annotations
- candidate design alternatives

It may not silently create authoritative flood depths, regulatory boundaries, survey coordinates, or construction dimensions.

## 11. Community fabrication

TrailPrint3D and PDF/Blender tooling enable:

`TSM Evidence/Design -> physical terrain model -> 3D print / drawing / exhibit`

This creates a useful community/family educational pathway while maintaining a clear distinction between educational/fabrication output and construction-controlled engineering.

## 12. Collaboration

Optional Mattermost/MagicOnion layers can support:

- design review
- evidence review
- task assignment
- scenario comments
- multiplayer laboratory sessions

The simulation itself must remain runnable with networking disabled.

## 13. Five-plane architecture

```
NATIVE EXPERIENCE PLANE
  Unreal Engine 5.8
  World interaction
  HUD
  Cameras
  Rendering

ENGINEERING PLANE
  Hydrology
  Hydraulics
  Terrain
  Geometry
  Numerics
  Transportation

EVIDENCE PLANE
  Source catalog
  Dataset snapshots
  Hashes
  CRS/datum
  Uncertainty
  Provenance

ARTIFACT PLANE
  Design IR
  USD
  STEP/IGES/STL
  Drawings
  Reports
  Grant packages
  Render packages

OPTIONAL RESEARCH/SERVICE PLANE
  AI/world models
  Blender
  Natron
  OpenFOAM
  OpenCV
  OSRM
  collaboration
```

## 14. Implementation sequence

### Phase 1 — contracts
- Expand Design IR.
- Add artifact schema/versioning.
- Add dependency/license manifest.
- Add solver-result contract.
- Add render-recipe contract.

### Phase 2 — CAD
- OCCT/OpenCAD isolated worker.
- STEP/STL validation.
- Design-to-geometry bridge.
- geometry provenance.

### Phase 3 — USD
- TSM USD schemas.
- terrain/flood/infrastructure prims.
- round-trip tests.

### Phase 4 — science
- OpenBLAS-backed numerical kernels.
- OpenCV inspection.
- OSRM infrastructure analysis.
- OpenFOAM adapter.

### Phase 5 — content
- BlenderGIS/Blender import/export.
- PDF drawing ingestion.
- terrain model fabrication.
- camera-track ingestion.

### Phase 6 — cinematic
- deterministic render recipes.
- engineering/cinematic camera modes.
- Natron/OpenFX/OpenShot finishing pipeline.

### Phase 7 — AI
- non-authoritative scene understanding.
- evidence-linked suggestions.
- design alternative generation.
- human approval before engineering-state mutation.

## Definition of done

A capability is accepted only when:

1. license is documented;
2. source revision is pinned;
3. SBOM entry exists;
4. security boundary is defined;
5. deterministic input/output contract exists;
6. evidence/provenance survives the transformation;
7. failure is explicit;
8. offline simulation remains functional;
9. engineering state cannot be mutated by cinematic presentation;
10. CI exercises the adapter;
11. representative real-world fixtures pass;
12. artifacts are hash-addressed.
