# Unreal authoring and training tools

These tools extend the existing UE5.8 project without introducing a server or account requirement. They are source integrations; Windows editor execution, optional plugin compilation, asset placement, and packaged runtime acceptance require separate evidence.

## Configure the editor

Run from the repository root:

```powershell
python scripts/configure_unreal_tools.py tsm-native/TSMNative.uproject
```

The command preserves other project settings, creates a one-time backup, and enables Cesium plus editor-only Python, editor scripting utilities, and Movie Render Pipeline. The backup is local; do not commit it. Restart the editor after changing plugin settings.

Optional plugins must be installed under `tsm-native/Plugins` before enabling them. The script does not download or license plugins. Use `--houdini` to enable Houdini authoring and `--flowgraph` to enable Flow and TSMTraining. The default project does not enable TSMTraining; its descriptor has EnabledByDefault=false.

## Blender and Houdini assets

BlenderTools can assist authoring but is not a runtime dependency. Export baked static meshes as FBX from Blender or Houdini. Establish a documented transform into the intended Unreal local coordinate frame before import. The scripts do not convert EPSG coordinates, NAVD88 elevations, geoid separation, or meters to centimeters. Record the actual transform receipt and license.

Create an asset manifest with `scripts/create_unreal_asset_manifest.py`: pass the FBX folder and required `--source-uri`, `--license`, `--horizontal-crs`, `--vertical-datum`, and `--transform-record` arguments using the reviewed values. Use one source/license/transform grouping per manifest. The command hashes files, rejects case-insensitive asset-name collisions, and refuses to overwrite an existing manifest.

Set `TSM_ASSET_MANIFEST` to the resulting absolute JSON path before launching Unreal Editor. Run `tsm-native/Content/Python/tsm_import_assets.py` through the editor's Execute Python Script command. It validates the whole manifest before importing, rejects paths outside its directory and existing destinations, imports FBX static meshes, and attaches source/checksum/transform metadata.

Import is not transactional: an importer or save failure can leave earlier imported assets. Review and remove partial imports with Unreal's asset tools before retrying. Metadata declares provenance; it does not independently certify geometry or persist as a runtime evidence ledger. Keep the source manifest in the versioned evidence pipeline.

Houdini Engine's free Unreal plugin license is distinct from Houdini authoring and batch licenses. Bake results before packaging. No live Houdini cooking is introduced in Shipping.

## Local Cesium tiles

Set `TSM_LOCAL_TILESET` to an existing absolute tileset JSON path beneath `tsm-native`. In the intended open map, execute `Content/Python/tsm_configure_local_tiles.py`. The script configures the existing native TSMOfflineTileset actor; it does not create another tileset implementation, save the map, or alter georeferencing.

Review the CesiumGeoreference origin and actual datum transforms, then save the map explicitly. Stage the tileset and its entire dependency closure as loose files at the same project-relative location in the packaged application. Existing source actor uses file URLs. Network-disabled boot and external-reference audits remain required.

## Asset conventions

Execute `Content/Python/tsm_check_asset_names.py` in the editor to check common asset prefixes and naming characters beneath /Game/TSM. This is a limited TSM convention inspired by Allar's guide, not full guide compliance or a copied implementation.

## Optional FlowGraph training

FlowGraph API signatures were inspected at commit `79880e06a21f4e4ffd5b88ac34685d323fea0327` on upstream branch 5.x. This identifies the inspected API source; it does not establish UE5.8 compile compatibility. Review upstream licensing and pin the chosen dependency before enabling. No third-party source is vendored.

TSMTraining provides a Training Step node with Start, Acknowledge, and Cancel inputs and Completed/Cancelled outputs. Bind the scenario UI to OnPrompt on the active node instance, then connect a deliberate user action to Acknowledge. The node ignores acknowledgement/cancellation while idle and resets its waiting state on cleanup. Graph owners must unbind UI delegates when their view ends.

No sample .uasset graph or UI binding is supplied. Create those in the editor and validate the actual interaction. Training references and instructions are informational; the node does not compute water levels or make regulatory decisions.

## Headed cinematic capture

Enable Movie Render Pipeline using the configuration command. Create an actual saved map, Level Sequence, camera cuts, and Movie Render Queue preset. The preset must specify the output format and directory.

Run `scripts/render_tsm_cinematic.ps1` with mandatory UERoot, Project, Map, Sequence, Preset, and LogFile parameters. Use real Unreal asset paths for map, sequence, and preset. The command launches UnrealEditor.exe visibly with -game -windowed and records a log. Exit code zero alone does not prove frames were rendered. Inspect frame output and retain its checksums.

Record FPS, VRAM, GPU/CPU, resolution, exact engine/plugin builds, dataset manifest, and commit alongside headed captures. This editor-based rendering is separate from Shipping packaging and clean-host network-disabled execution.

## Verification

```bash
python -m unittest discover -s tests -p test_unreal_authoring_tools.py -v
python -m compileall -q tsm-native/Content/Python scripts/configure_unreal_tools.py scripts/create_unreal_asset_manifest.py
```

The scoped GitHub workflow runs Python tests/syntax checks and Windows PowerShell parsing. It does not execute Unreal or compile the optional C++ plugin. Native Shipping, maps, countywide geometry completeness, geodetic accuracy, and regulatory certification remain independent gates.

## Upstream references

- https://github.com/CesiumGS/cesium-unreal
- https://github.com/sideeffects/HoudiniEngineForUnreal
- https://www.sidefx.com/faq/indie-new/
- https://github.com/EpicGames/BlenderTools
- https://github.com/Allar/ue5-style-guide
- https://github.com/MothCocoon/FlowGraph
- https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/AssetImportTask

AirSim, Nakama, UnrealCLR, UEVR, and unreal-mcp are not dependencies of these integrations. They require separate feature, compatibility, and architecture decisions.
