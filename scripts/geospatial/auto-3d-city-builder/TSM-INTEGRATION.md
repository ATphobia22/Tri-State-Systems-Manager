# Auto-3D City Builder: TSM reconstruction subsystem

Canonical development home: this TSM repository. Imported MIT-licensed runtime v0.2.1 from the owner's Auto-3D City Builder plugin. The standalone plugin is a local client/distribution, not a competing twin. The upstream viewer and direct ArcGIS acquisition remain reference tools; do not deploy the viewer or use the offset-paged acquisition for the TSM authority path.

## Headless integration

Use the existing checksummed government scene from `scripts/geospatial/build_mount_vernon_scene.py`. Keep outputs outside deployed/public asset roots; this adapter never publishes. From repository root:

```sh
python -m pip install -e 'scripts/geospatial/auto-3d-city-builder[test]'
python -m pytest scripts/geospatial/auto-3d-city-builder/tests -q
python -m citybuilder.tsm_adapter /path/to/reviewed-scene /path/to/new-candidate --estimate-missing
```

The adapter validates the scene receipt and counts, preserves TSM identity and source feature digests, projects planimetric WGS84 to NAD83 UTM 16N (EPSG:26916), calls the reusable builder, and hashes all candidate outputs. The source scene's planimetric data cannot establish height or ground; estimates require explicit opt-in. No input is mutated. The output is a relative visual candidate, not terrain-aligned, not publication-eligible, and not engineering-eligible. A digest establishes integrity, not agency authenticity or regulatory approval.

## Reuse existing production paths

| Stage | Existing TSM owner |
|---|---|
| Government source intake | build_mount_vernon_scene.py / Posey official inventory |
| Terrain and vertical evidence | tsm_geodesy.py, transform_dem_with_evidence.py, dem_to_transvoxel.py |
| Measured roofs and height gaps | reconstruct_lod2_roofs.py, emit_building_height_gap_evidence.py |
| Semantic staging and tiling | citygml_to_3dtiles.py, build-building-3d-tiles.py, build-building-hlod.py |
| Visual receipt and acceptance | validate_visual_asset_receipt.py, validate_building_acceptance_chain.py |
| Public and native viewers | existing TSM console and native application only |

Future adapters: terrain/geoid-aligned candidate promotion, 3DCityDB exchange, historical georeferencing, photogrammetry/3DGS worker, and shared public/native publication. Existing outputs are not replaced. The bundled reference viewer requires CDN and the local MCP server uses synchronous execution; neither is the production service. The upstream candidate mesh is not validated for manifoldness, glTF axis conventions or projection convergence. No GPU training or citywide data run is implied by importing the code. No separate public site, credentials, private plugin config, or generated models are included.

## Real-source pilot and acceptance boundary

The `auto-3d-city-builder-pilot.yml` workflow runs TSM's own government scene acquisition over a bounded downtown-area pilot (not a municipal boundary), builds the visual candidate, independently checks hashes, source ID coverage, GLB headers, tileset references and estimate authority, and retains a review artifact. It does not deploy the artifacts. Re-run locally using the same source scene and `python -m citybuilder.candidate_gate SCENE CANDIDATE`. This gate does not validate mesh topology, terrain/geoid alignment, absolute height or publication rights. The separate county-scale building workflow retains the existing strict height and LoD acceptance gates; its authority validator invocation now supplies the required implicit tiles directory. No engineering gate has been relaxed.

## Source-bound vertical candidate branch

`auto-3d-city-builder-vertical.yml` runs the existing 3DEP EPT extractor over the pilot scene, requires explicit EPSG:5703 metadata before interpreting metre Z, and binds candidate heights to unchanged source identity and geometry. The bridge checks the official GEOID18 grid digest, uses the existing geoid library and existing TSM LoD1 tile generator/validator with strict geoid placement and no height fallback. Unavailable IDs remain in the review ledger. EPT metadata and extraction output are pinned locally, not independently authenticated; raw individual LAZ node digests and epoch-aware frame/checkpoint acceptance remain outstanding. The existing extractor includes classes 6 and 8 and simplified footprint sampling; resulting heights are unreviewed derived candidates only. No public or regulatory use is enabled.

### COPC recovery after EPT metadata rejection

The 2013 Posey EPT and 2017 statewide EPT metadata expose EPSG:3857 horizontal only, so neither establishes NAVD88 metres for this adapter. The vertical pilot now uses TSM's existing Indiana 2020 COPC recovery with single-tile opt-in and all adjacent footprint/ground windows. It checks the compound LAS header (EPSG:2968 + EPSG:6360), raw tile SHA-256, scene input and derived output digests before nominal geoid placement. No source datum override is introduced. Class 1 elevated returns remain inferred roof candidates, not classified/surveyed roofs; GEOID12B-derived absolute elevations, nominal GEOID18 placement and horizontal epoch differences require independent review. Zero accepted heights is a blocked result, not a pass.

### Independent vertical artifact audit

The follow-on `auto-3d-city-builder-vertical-audit.yml` workflow runs after a successful main-branch vertical pilot, or by manual run ID. It downloads the specific workflow's review artifact, reconciles the exact source IDs into derived candidates and unresolved IDs, checks candidate geometry identity and provenance, and verifies the LoD1 tile content inventory and GLB hashes. It never executes code from the downloaded artifact. A pass is integrity only, not independent revalidation of raw COPC headers, geometry accuracy, terrain contact, licensing or production acceptance. Test extras now include the point-cloud dependencies so COPC tests execute rather than skip.

### Raster gap and base-contact review

The raster workflow downloads the exact successful COPC pilot (run 45769088253), verifies its vertical artifact, then acquires bounded Indiana 2020 nDHM, DSM and DEM GeoTIFFs from the existing public elevation archive. It pins bytes and checks CRS/vertical units, reports correlated raster height candidates only when coverage and agreement checks pass, and checks nominal building base elevation against DEM footprint boundary samples. It never replaces the 425 existing candidates or promotes the 100 gaps. The 0.5 m contact tolerance and 2 m raster agreement threshold are screening policies, not regulatory accuracy standards. Raw raster evidence is retained even if headers are insufficient; no automatic assumption about missing Z units. Actual decoded mesh/terrain and independent checkpoints, and real roof-plane reconstruction, remain separate stages. Sources: https://gis.iu.edu/s/isdp/page/20162020elevation and https://lidar.digitalforestry.org/ .

## Semantic city exchange profiles

See `semantic/README.md` for the version-specific CityDB views and strict 3dfier profile. These are unexecuted integration templates; no database service or public release is provisioned.

### PDAL and Roofer review pilot

The new workflow reuses the exact 525-feature scene from run 45769088253 and redownloads the same two Indiana 2020 COPC tiles with the previously observed SHA-256 digests. It requires compound EPSG:2968 + 6360 source headers, projects to EPSG:2793 + 5703 (metric counterpart, not a new datum), filters withheld and non-relevant classes without reclassifying Class 1, and builds co-registered DTM/DSM/nDSM rasters. Generated raster Z metadata is bound to the verified metric point cloud; external rasters with unknown Z remain blocked. NOAA InPort 69202 provides source collection metadata. The raster and base-contact diagnostics are correlated with the source LiDAR and are not independent checkpoints. The Roofer v1.0.0 binary is pinned to the official release digest and explicitly uses unclassified Class 1 as an experimental input; no class 6 claim is made. CityJSONSeq review checks source ID, standard LoD2.2 solid output, shell edge incidence, roof semantics, fit diagnostics and footprint overlap. It does not establish full topological validity, independent survey accuracy, temporal equivalence, native Cesium placement or publication approval. A successful process with zero structural candidates is a blocked run. See https://innovation.3dbag.nl/roofer/cli_application.html and https://www.fisheries.noaa.gov/inport/item/69202 .

### Runtime bootstrap recovery

Run 45771846066 passed 43 tests and acquired the baseline artifact, but failed before processing because the runner had no conda executable. The workflow now downloads micromamba 2.3.3-0 from its upstream release with a pinned SHA-256, records the resolved conda-forge package inventory, verifies the PDAL 2.9.3 executable and required stages, and runs a real synthetic compound-CRS/raster smoke test before touching the real point clouds. This synthetic test is opt-in only in the ordinary Python suite; it is required in the actual PDAL job. No acceptance threshold or source digest was changed.

### Native PROJ data isolation

Run 45772227110 installed PDAL 2.9.3 successfully, but the executable smoke test failed to initialize its PROJ database before processing. The native launcher now supplies the matching environment's PROJ_DATA, PROJ_LIB, GDAL_DATA and library path only to native executables, checks the database exists, disables network grid retrieval, and removes conflicting GDAL plugin paths. The workflow records the PROJ database checksum and compound coordinate-operation summary before the original real executable smoke test. Python geospatial library environments remain untouched. Two launcher regression tests verify contaminated environment isolation and rejection of a missing database. No coordinate datum, source geometry, or acceptance threshold changed.
