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
