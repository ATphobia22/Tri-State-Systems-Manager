# Open-Source Engineering Integration Plan

**Status:** implementation contract and adoption plan; not a claim that every listed engine is installed or production-ready.  
**Updated:** 2026-10-24

## Objective

Use the smallest compatible set of open-source tools to improve TSM's geospatial ingestion, offline maps, 3D digital twin, and scientific-model reproducibility. Keep the default path free of account/API-key requirements. External public data may still require network access; offline mode must use pinned local artifacts.

The machine-readable source of truth is `integrations/open-source-engine-registry.json`. Validate it with:

```bash
node scripts/ci/validate-open-source-engine-registry.mjs
node --test scripts/ci/validate-open-source-engine-registry.test.mjs
```

The registry records adoption class, licensing, credential assumptions, status, role, and authority boundary. It is not an installation manifest and must never trigger automatic package installation.

## Target architecture

```text
Authoritative sources + pinned offline snapshots
    -> schema/CRS/datum validation
    -> source, feature, dataset and evidence hashes
    -> versioned PostGIS/local artifact holdings
    -> GDAL / PROJ / WhiteboxTools preprocessing
    -> H3 derived aggregation where useful
    -> Tippecanoe or validated 3D Tiles build
    -> Martin for dynamic vector tiles OR PMTiles for static/offline delivery
    -> MapLibre for operations + Three.js for custom scenes + CesiumJS for globe/3D Tiles
```

Use PostGIS as a queryable store when provisioned. Keep a portable local-artifact path for air-gapped deployments. Never make production behavior depend on a hosted account service when a self-hosted/offline alternative is viable.

## Adopt now

1. **Preserve MapLibre GL JS as the operational map.** Use it for base maps, authoritative overlays, legends, and operator interaction.
2. **Keep Three.js and CesiumJS as complementary renderers.** Three.js serves custom meshes and scene overlays; CesiumJS serves globe-scale terrain, point clouds, and 3D Tiles. Do not replace one with the other without an explicit performance/feature benchmark.
3. **Use PMTiles for portable snapshots and Martin for dynamic tiles.** They are complementary delivery paths. PMTiles should be generated reproducibly and verified before publication; Martin must use least-privilege read-only database access for tile queries.
4. **Use GDAL/PROJ for reproducible raster/vector preprocessing.** Pin versions, transformation grids, CRS, vertical datum, units, nodata rules, and command arguments in each processing manifest. Missing transformation grids are a hard validation failure when they affect results.
5. **Keep H3 as a derived index.** Store the original geometry and its source/provenance alongside cell IDs and aggregation parameters.
6. **Use 3D Tiles Tools and glTF Transform in CI for structural validation/optimization.** Keep them in the CI tooling lane, not in the browser application dependency graph.
7. **Use Turf.js only for bounded client-side analysis.** Label results exploratory and do not substitute browser calculations for a calibrated hydraulic solver.

## Conditional integrations

- **deck.gl:** adopt for measured high-volume analytical-layer needs; benchmark against current MapLibre custom layers.
- **Tippecanoe:** adopt for large/multizoom vector-tile builds; keep the current pure-Python PMTiles example as a demo, not the production default.
- **WhiteboxTools:** use for documented terrain/hydrologic preprocessing, with pinned tool versions and known-answer fixtures.
- **MODFLOW 6:** use for groundwater investigations through a solver adapter that captures model files, version, convergence, calibration and uncertainty.
- **QGIS:** analyst workstation and reproducible processing workflows; record project CRS and processing history.
- **CityGML Tools / 3DCityDB / val3dity:** use only when CityGML/CityJSON building-model requirements are present; validate geometry and LOD before 3D Tiles conversion.
- **iTwin.js, Godot, O3DE, Panda3D, Babylon.js, Bevy and CARLA:** do not add to the default runtime. Adopt only for a written capability gap, measurable acceptance criteria, licensing review, and a separate build/runtime boundary.
- **OpenFOAM:** optional specialist CFD lane, not a replacement for watershed or floodplain modeling.
- **HEC-RAS:** useful existing specialist software but **not open source**. Keep it clearly identified as external engineering software; its host/runtime constraints and terms remain separate from open-source tooling.

## Cesium ion Stories

Use [Cesium ion Stories](https://ion.cesium.com/stories) as a reference for storytelling and guided 3D scene composition only. Do not make ion account credentials, hosted assets, or tokenized endpoints part of the credential-free default. For TSM-hosted equivalents, store a story manifest referencing locally controlled tileset URLs, camera/view state, layer IDs, timestamps, provenance links, and accessibility text. Any hosted ion use remains optional and must be separately configured and reviewed.

## Evidence and authority rules

- A renderer, tile archive, spatial index, geometry conversion, or solver process does not independently establish regulatory authority.
- Keep FEMA effective NFHL and state planning layers separate in source ID, legend, metadata, and provenance.
- Record source URI, retrieval time, source version, input/output hashes, CRS, horizontal and vertical datum, units, transform pipeline, software version, and arguments for derived artifacts.
- Record model solver version, mesh, boundary conditions, calibration/validation status, run status, convergence, and uncertainty. A zero exit code is necessary but insufficient.
- Preserve source IDs and feature lineage through simplification, clipping, aggregation, and tiling.
- Do not commit large source rasters or credentials to Git. Keep artifacts in explicitly managed holdings with manifests and hashes.
- In offline mode, fail closed when required artifacts or datum grids are missing; do not silently fetch network data or fabricate a replacement.

## Acceptance gates

- [ ] Registry validates and has unique IDs, valid URLs, allowed classifications, explicit license and authority boundary for every engine.
- [ ] Core dependencies remain account-free and no hosted ion token is required.
- [ ] PMTiles demo round-trips through the reader; production outputs have metadata and SHA-256 manifest.
- [ ] Martin tile endpoint health and PostGIS connectivity are checked only in an environment where those services are configured.
- [ ] 3D Tiles validation runs in CI on deterministic fixtures.
- [ ] CRS/datum transformations include known-answer tests and fail if required grids are missing.
- [ ] Derived outputs retain source IDs, source hashes, tool versions, and command/configuration manifests.
- [ ] Scientific-model results remain labeled model outputs and require domain validation/human review.
- [ ] Licensing is reviewed before bundling tools or distributing generated assets.
- [ ] No integration is called operational until its runtime, data, failure behavior, and tests are demonstrated.

## Scope boundary

This plan does not install system packages, provision a PostGIS server, acquire restricted data, download large public datasets, run an engineering design, or claim that every candidate engine is deployed. Those actions require explicit environment/data availability and, for model outputs, engineering validation.
