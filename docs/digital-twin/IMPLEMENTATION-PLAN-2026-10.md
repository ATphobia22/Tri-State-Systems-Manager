# Evidence-first flood digital twin implementation plan

**Status:** Proposed implementation contract; not a claim of deployment or engineering validation.  
**Target:** One reproducible, geographically bounded river-reach vertical slice.  
**Scope:** Stable entity identity, source acquisition, hydraulic results, 4D state, interactive visualization, and evidence lineage.

## Existing repository capabilities to reuse

This repository already has a browser-based flood simulator, HEC-RAS evidence schemas, a geospatial tile fabric, a terrain pipeline, temporal provenance utilities, and twin-state contracts. Extend these components rather than introducing a second authoritative data model. In particular, reuse:

- `docs/ENGINEERING-EVIDENCE-PIPELINE.md` for the evidence gates;
- `docs/FLOOD-SIMULATOR.md` for the screening simulator and its stated limitations;
- `data/schemas/hec-ras-2d-real-output-artifact.schema.json` for calibrated real-model artifacts;
- `data/schemas/tsm-twin-state-v1.schema.json` for state snapshots;
- `data/schemas/geospatial-tile-fabric.schema.json` and `artifacts/tsm-geospatial-tile-fabric-v1.json` for published geospatial assets;
- `data/geospatial/terrain-runtime-contract-v1.json` for terrain runtime readiness;
- existing CI workflows before adding a new validator.

## Reference architecture

```text
Official data / licensed survey / gauge observations
  |  raw bytes + source URI + retrieval time + response metadata + SHA-256
  v
Acquisition manifest + immutable evidence/artifact IDs
  v
CRS, units, vertical datum, geoid model, coverage and quality gates
  v
PostGIS / raster catalog / versioned source & entity registry
  |                                      |
  | model inputs                         | stable TwinEntityID + relationships
  v                                      v
HEC-RAS 2D (or reviewed fit-for-purpose solver)     Twin-state service
  | depth, velocity, WSE, arrival, uncertainty      | observation/model/scenario time
  v                                                v
Validated result package + model/calibration evidence
  |                                        |
  +--> tiled raster / vector / 3D Tiles <--+
                      |
                      v
MapLibre/Cesium web twin and optional Unreal visualization
                      |
                      v
Optional Houdini/Blender authoring -> EXR render -> Natron/OpenColorIO comp
```

The scientific model and the renderer are separate systems. Houdini's heightfield shallow-water solver is appropriate for art direction, visualization, and controlled prototyping; it is not accepted as the authoritative hydraulic result solely because it looks plausible. A production flood claim needs a fit-for-purpose model, documented inputs and boundary conditions, calibration/validation evidence, uncertainty characterization, and qualified review. HEC-RAS 2D is a candidate, not a blanket endorsement: terrain, bathymetry, mesh, structures, roughness, boundary conditions and calibration all determine fitness.

## Identity and state contracts

1. `TwinEntityID` is an immutable application-level identifier. Do not use Unreal actor names, Blender object names, Houdini paths, tile coordinates, parcel display labels, or a provider's mutable row number as the sole identity.
2. Preserve external identifiers separately as namespaced aliases (e.g. `USGS:03378500`, source parcel ID, road segment ID).
3. Keep entity identity and relationships in the registry/database. Blender, Houdini, Unreal, Cesium, Natron and 3D Tiles are consumers/producers of versioned artifacts, not authorities for the entity's identity.
4. Every dynamic value records its quantity, unit, effective time, source/model artifact, status and uncertainty where known. Missing uncertainty must be explicitly unknown, not zero.
5. Distinguish `OBSERVATION`, `FORECAST`, `REGULATORY`, `MODEL_OUTPUT`, `SCENARIO`, and `VISUALIZATION`. Never merge these into a single undifferentiated “truth” value.
6. Use bitemporal semantics where useful: `valid_time` describes when a fact applies; `recorded_at` describes when TSM learned or recorded it.
7. Use a versioned twin snapshot for scrubbing. The timeline must not silently mix observations, forecasts, historical records and hypothetical scenarios.

## Coordinate reference and vertical datum gates

- Retain original coordinates and the source CRS identifier before transforming.
- Require horizontal CRS, axis order, linear/angular units, vertical datum, vertical units and transformation operation where relevant.
- For raster comparisons, record grid resolution, affine transform, nodata, resampling method, pixel alignment and source footprint.
- For hydraulic modeling, verify that terrain and bathymetry represent the correct bed/surface and share a documented vertical reference with boundary conditions and structures.
- Do not infer NAVD88, a geoid model, local datum, or CRS from a state/county name. Unknown means blocked for operations that depend on it.
- Keep transformations reproducible: software/version, operation/pipeline, grid files and their hashes, parameters, and output hash.

## Initial vertical slice

**Recommended pilot:** one explicitly bounded reach in the Ohio–Wabash region selected after source coverage, access, bathymetry, gauges and engineering review are verified. Do not preselect a reach solely because it has attractive public terrain tiles.

### Inputs

- USGS Water Data API: monitoring-location metadata and time series relevant to the reach.
- USGS 3DEP elevation product with its product metadata and vertical reference; add verified bathymetry/topobathy when the submerged channel materially affects the model.
- FEMA NFHL effective layers as regulatory reference only, with effective dates and service metadata retained.
- Reach geometry, structures, roughness, inflow/outflow boundary conditions and calibration observations supplied/approved by the modeling team.
- Optional parcel/road/building context as exposure layers, never as hydraulic boundary truth by default.

### Processing

1. Select a reach and record the AOI as a versioned geometry.
2. Acquire a small, bounded source package. Store original bytes outside Git if large; check in a manifest, hashes and a small redistributable fixture only.
3. Run source-quality gates and CRS/vertical datum checks before deriving model inputs.
4. Build a baseline model and retain model package hash, software version, solver settings, mesh, boundary conditions, calibration and validation reports.
5. Export time-indexed water-surface elevation, depth, velocity and relevant derived metrics with units, grid geometry, nodata, and the exact model-run ID.
6. Register outputs as `MODEL_OUTPUT` artifacts and link them to the source/model inputs. A demo/screening output must never validate as a calibrated real-model artifact.
7. Join model values to parcels, roads, berms, river segments, streamgages, buildings and utilities through stable IDs and explicit spatial/graph relationships.
8. Render a timeline in the existing twin surface. Use Unreal only if the use case requires high-fidelity interactive 3D; do not make Unreal a prerequisite for data correctness.
9. Produce an optional composited deliverable from EXR renders with a pinned OpenColorIO configuration and explicit display transform. Natron is a downstream compositor, not the scientific source of truth.

### Acceptance tests

- Same versioned input bundle and solver configuration reproduce the same input/output hashes where the toolchain supports deterministic output, or documented numeric tolerances where it does not.
- Every result cell/feature resolves to a model run, model package, source artifacts, CRS/vertical datum and units.
- Missing source metadata, transformation grids, calibration evidence or model package hash blocks publication as a real model output.
- TwinEntityID survives GeoJSON/GeoParquet, tile generation, editor import/export and entity selection without duplication or reassignment.
- Scrubbing is deterministic and explicitly displays time basis, timezone, scenario, provenance class and stale/missing intervals.
- Scenario comparisons use the same baseline and state assumptions; changes to levees, roads, pumps or structures are versioned inputs, not edits to source terrain.
- Visual checks include tile seams, LOD transitions, floating/embedded assets, no-data holes, color-map units, accessibility and an uncertainty/status legend.
- An offline test runs from a declared bundle with outbound network disabled and reports all unavailable dependencies.

## Delivery gates

### P0 — prove the data/model/evidence path
- [ ] Select and document one AOI and reach.
- [ ] Verify terrain/bathymetry, gauge coverage, source terms and vertical datum.
- [ ] Run or import one reviewed hydraulic model output; do not substitute an art simulation.
- [ ] Register source, model and output manifests with SHA-256 hashes.
- [ ] Map output to stable entity IDs and show one time step in the existing twin UI.
- [ ] Add regression tests for identity, provenance, CRS/datum and no-data behavior.

### P1 — operationalize time and scale
- [ ] Store versioned twin snapshots and temporal relationships.
- [ ] Add tiled result delivery with resolution/LOD metadata and immutable content hashes.
- [ ] Add observation-vs-forecast-vs-model-vs-scenario filters.
- [ ] Add cross-run comparison, uncertainty overlays and freshness gates.
- [ ] Add automated offline-bundle validation and restore testing.

### P2 — authoring and cinematic workflow
- [ ] Export entity IDs and source metadata into Blender/Houdini assets.
- [ ] Use USD where a tested interoperability path preserves the needed attributes; test round-trips instead of assuming metadata fidelity.
- [ ] Build Unreal actors/components that reference TwinEntityID and request versioned state from the twin registry.
- [ ] Scrub with Sequencer against a selected snapshot/scenario ID.
- [ ] Render linear EXR with documented working space; composite with a pinned OCIO config and record the display transform/output profile.
- [ ] Label cinematic output with scenario, run ID, data timestamp and “visualization—not a regulatory determination” where appropriate.

## Resource and acquisition policy

- Prefer official API/service endpoints and record response headers, retrieval time, query parameters, terms, license/attribution, and SHA-256.
- Use small sample fixtures in Git. Keep large rasters, HEC-RAS project bundles, point clouds, Unreal binary assets and EXR sequences in a content-addressed object store or release artifact unless there is a reviewed reason to version them.
- Do not mirror manuals or third-party source repositories wholesale. Link to their canonical docs and pin compatible versions/hashes in the toolchain manifest.
- Cesium ion and other hosted services may require accounts/tokens or commercial terms. Air-gapped delivery must use locally stored, legally redistributable datasets and pinned software packages.
- Every downloaded item must be traceable to a source URL and checksum. Never treat a successful download as proof of currency, correctness, license, or suitability.

## Official technical references

- HEC-RAS documentation: https://www.hec.usace.army.mil/software/hec-ras/documentation.aspx
- HEC-RAS 2D User's Manual v6.6: https://www.hec.usace.army.mil/software/hec-ras/documentation/HEC-RAS_2D_Users_Manual_v6.6.pdf
- USGS Water Data APIs: https://api.waterdata.usgs.gov/
- USGS 3DEP: https://www.usgs.gov/3d-elevation-program
- FEMA NFHL GIS services: https://hazards.fema.gov/femaportal/wps/portal/NFHLWMS
- Cesium for Unreal docs: https://cesium.com/learn/cesium-unreal/ref-doc/
- Cesium for Unreal offline FAQ: https://cesium.com/learn/unreal/unreal-faq/
- Houdini Shallow Water Solver: https://www.sidefx.com/docs/houdini/heightfields/shallowintro.html
- Houdini Heightfields: https://www.sidefx.com/docs/houdini/heightfields/index.html
- Natron: https://natrongithub.github.io/
- BlenderGIS: https://github.com/domlysz/BlenderGIS
- OGC Cloud Optimized GeoTIFF: https://www.ogc.org/standard/cloud-optimized-geotiff/
- STAC specification: https://stacspec.org/

## Definition of done

The vertical slice is done when an independent reviewer can reproduce the acquisition manifest and hashes, identify the exact source and model versions behind every displayed value, trace the selected feature to its stable ID, reproduce the time selection, and distinguish real model output from screening simulation and cinematic visualization. A render or a green CI check alone does not satisfy this definition.
