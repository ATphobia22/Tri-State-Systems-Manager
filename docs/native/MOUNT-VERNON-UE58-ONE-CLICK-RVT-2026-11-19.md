# Mount Vernon 47620 — UE5.8 editor one-click vectors and RVT material authoring

**Status: editor source implementation; UE5.8 C++ build, .uasset creation, headed RVT capture, real 1:1 town fidelity and Windows Shipping are NOT EVIDENCED until verified on the Windows runner.**

This extends `tsm-native/TSMNative.uproject` and the existing `/Game/Maps/TSMRegion` World Partition creator. Python is **Editor only**. The Shipping runtime uses the native `ATSMMountVernonVectorActor` geometry and source/evidence attributes, not an embedded Python service or WebView. Do not classify generated vector controls as finished building meshes, engineered flood surfaces, or verified cinematic scenes.

## Why input metadata are mandatory

The two currently documented local Mount Vernon DEM tiles are **EPSG:2968**, not necessarily EPSG:2966; their NAVD88 vertical source units/datum are **not independently verified**. See `docs/mount-vernon-terrain-real-dem-ue58-integration.md`. A saved heightmap's `uint16` encoding and an arbitrary center height do not establish a verified geodetic transform. The prior hand-written pipeline also used incorrect LiDAR canopy maxima (absolute point elevations rather than ground-subtracted heights), fell back to guessed missing elevations, and did not validate footprints with holes.

**Headless** preparation must first normalize DEM/LiDAR CRS and confirm vertical datum/units, sample ground Z at each footprint or road vertex and generate source IDs. For an imported *UE local* GeoJSON, require a reproducible transform receipt, source CRS, origin, vertical model, vertical units, coordinate axes, SHA-256 and source URI. Keep physical world precision with local origins/world partition and, if using Cesium, a reviewed CesiumGeoreference; never add global EPSG coordinates directly to float UE actor transforms.

### Package layout (locally staged, not GitHub binary storage)

```text
C:/TSMData/MountVernon/
  manifest.json
  buildings.geojson
  roads.geojson
  trees.geojson
```

`manifest.json` contract — replace placeholders with **actual verified values and SHA hashes**; this is a schema example, not a complete downloadable city:

```json
{
  "schema_version": "tsm.mount-vernon.editor-package.v1",
  "coordinate_frame": {
    "space": "LOCAL_UNREAL_CM",
    "axes": "X_EAST_Y_SOUTH_Z_UP",
    "horizontal_crs": "EPSG:2968",
    "vertical_datum": "UNVERIFIED",
    "vertical_units": "UNVERIFIED",
    "origin": {
      "easting": 0,
      "northing": 0,
      "elevation": 0,
      "unit": "us-ft"
    }
  },
  "scene": {
    "world_partition_map": "/Game/Maps/TSMRegion",
    "evidence_status": "PENDING_EVIDENCE"
  },
  "datasets": [
    {
      "kind": "building",
      "path": "buildings.geojson",
      "sha256": "REPLACE_WITH_ACTUAL_64_CHARACTER_SHA256",
      "source_uri": "REPLACE_WITH_VERIFIED_SOURCE_RECORD",
      "source_crs": "EPSG:2968",
      "expected_feature_count": 1
    }
  ]
}
```

GeoJSON is ALREADY in Unreal-local **centimeters**: `X=east, Y=south, Z=up`. Building Polygon, MultiPolygon, road LineString/MultiLineString and tree Point are supported. Each feature must have a stable `properties.source_id`. 2D vertices also require explicit `properties.ground_z_cm`; 3D vertices carry local Z. Building holes fail validation rather than being silently discarded; flatten/triangulate separately with retained evidence. Preserve road elevation variation using 3D lines. Footprint heights/roof type are only metadata; not automatically certified measured dimensions.

## Install and open the Editor Utility Widget

1. On the Windows UE5.8 editor workstation, sync this branch and open `tsm-native/TSMNative.uproject`. Confirm the `TSMMountVernonEditor` Editor-only project plugin, `PythonScriptPlugin`, `EditorScriptingUtilities`, and `PCG` dependencies are enabled; rebuild the C++ Editor target. A successful package build is a **separate** gate.
2. In an open Editor session run `tsm-native/Tools/Create-World-Partition-Map.py` if `/Game/Maps/TSMRegion` is missing. Open that specific saved map. Never overwrite a pre-existing map by script.
3. In Editor **Tools → Execute Python Script**, run `tsm-native/Content/Python/tsm_mv_bootstrap_widget.py` ONCE. It creates `/Game/TSM/Editor/BP_TSM_MountVernonTownGenerator` with the native widget as its parent, saves it and opens its tab. This Blueprint is generated on the target UE installation; the binary `.uasset` is not represented by a text file in Git.
4. Type the absolute local `manifest.json` path, click **1. Preflight**. It verifies the CRS/coordinate contract, SHA hashes, stable IDs, geometry and current level without editor mutations.
5. Click **2. Generate tagged native splines** once. It creates `TSMMountVernonVectorActor` actors in `TSM/MountVernon/Building|Road|Tree` with `MV_Building|MV_Road|MV_Tree` tags. Closed building footprint splines support the native PCG reader. Coordinates use UE local X/Y/Z relative to their first vertex. Trees become typed point actors.
6. Find the receipt at `Saved/TSM/MountVernon/<manifest-sha-prefix>.json`. Status `EDITOR_VECTORS_GENERATED` means **vectors only**. A cancelled/error run writes `PARTIAL`: manually inspect the world before rerunning. The tool refuses reimport of a manifest with any prior receipt and refuses colliding loaded actor labels.
7. Click **3. Create RVT/material templates** to create the landscape writer, road blend, foundation blend and RVT asset. This does **not** alter an existing surveyed terrain material or fit RVT volumes automatically.
8. Save the map and run the headed rendering, World Partition/HLOD and offline Windows Shipping acceptance pipeline; preserve both screenshots and raw logs.

## PCG graph wiring in UE5.8 (asset-authoring step, not generated by this PR)

| Graph | Input | Operations | Output |
|---|---|---|---|
| `PCG_TSM_MV_Buildings` | Get Actor Data + tag `MV_Building`, native `Footprint` spline and typed actor height/roof metadata | Separate flat vs gable, sample polygon boundary, Geometry Script triangulation with holes validated, footings sampled to confirmed terrain, optional facades | Bake to static meshes/Nanite and register source_id per building; inspect roof residuals before release |
| `PCG_TSM_MV_Roads` | Get Actor Data + `MV_Road` and native 3D spline vertices | Spline Sampler → Spline Mesh or asset-authored road geometry → UV/vertex-alpha edge blend → reviewed landscape deformation | Mesh writer with RVT sample; inspect grade/crossfall and road intersections |
| `PCG_TSM_MV_Trees` | Get Actor Data + `MV_Tree` points | Source-classified canopy height and locally checked species/biome rules; bounded seeded scatter only for decorative uncertainty | HISM/Nanite foliage; label observed vs derived trees |

The empty/native splines are *input controls*, not completed PCG graph `.uasset` files. Do not assume Unreal parses arbitrary `Key:Value` Actor Tags as typed attributes; the native actor exposes `HeightCm`, `EaveCm`, `RoadWidthCm`, `FeatureId` and `SourceSha256` as reflected properties. Explicitly configure the PCG Get Actor Data node's property extraction or a typed attribute adapter. World Partition PCG runtime grids and HLOD tier settings must be measured on the target GPU; 60 FPS is a target, not a proven number.

## RVT landscape → roads / foundations

Generated assets in `/Game/TSM/MountVernon/Materials`:

- `RVT_TSM_MV_Surface` — RuntimeVirtualTexture asset; its material type must match the sample expressions.
- `M_TSM_MV_LandscapeRVTWriter` — base-color/roughness writer with `Runtime Virtual Texture Output` expression, preview scalar/vector parameters.
- `M_TSM_MV_RoadEdgeBlend` and `M_TSM_MV_FoundationEdgeBlend` — `Runtime Virtual Texture Sample` BaseColor lerped with road/foundation PBR preview color. **Vertex Color Alpha** is the edge blend mask: 0 = terrain, 1 = mesh material. Actual generated mesh vertices must encode this graded mask, not an arbitrary +3.5 cm height offset.

Required manual editor scene binding (deliberately non-destructive):
1. Turn on `r.VirtualTextures=True` (already configured in `tsm-native/Config/DefaultEngine.ini`); restart the Editor if setting changes.
2. Add a `Runtime Virtual Texture Volume` inside the validated landscape extent; assign `RVT_TSM_MV_Surface` to its component, and set/verify the volume bounds to cover only intended source geometry.
3. Add that RVT asset to the Landscape actor's **Draw in Virtual Textures**; use the generated writer output or integrate its `Runtime Virtual Texture Output` logic into the existing authoritative landscape master. Never overwrite terrain shading blindly.
4. Apply road/foundation blend materials to geometry with a **vertex-color alpha falloff** along engineered mesh edges. Keep the road body opaque; use the fallback material path when RVT is unavailable. Confirm RVT sample type matches the RVT asset.
5. In Shader Complexity/RVT debug modes inspect virtual texture residency, seam transitions, normal/roughness consistency and performance from the riverfront to downtown. Replace sample swatches with source-licensed weathered asphalt, brick and limestone PBR materials.
6. Keep hydrologic rendering separate: an Ohio River visual water shader must not be interpreted as measured stage/depth without independently verified water-level and datum evidence.

## Verification and release gates

```bash
python -m unittest discover -s tests -p test_mount_vernon_editor_contract.py -v
python -m compileall -q tsm-native/Content/Python/tsm_mv_*.py
```

| Gate | Evidence |
|---|---|
| Headless manifest and GeoJSON contract | CI Python tests + sample with actual source hashes |
| UE5.8 Editor C++ class/widget generation | Windows `UnrealBuildTool` compile, actual `BP_TSM_MountVernonTownGenerator.uasset`, clicked-button logs |
| Native spline placement/precision | loaded-map/world-origin QA, sample/checkpoint residuals, actor counts and map saved |
| PCG baked buildings/roads/trees | real `PCG_*` graphs, mesh screenshot and source-ID reconciliation |
| RVT writer, sampler and volume | headed screenshot showing road/landscape edge falloff with expected PBR texture channels |
| Offline native Shipping | BuildCookRun Shipping executable, network-disabled clean Windows boot, screenshots, FPS/VRAM/logs |

No source .umap or `.uasset` is committed here, no licensed texture/terrain data bundled, and the original two DEM preview files do not verify contiguous 8 km × 8 km heightmap coverage. Source-backed visual proof and surveyed vertical transforms are required before claiming a 1:1 city or green native release.

References:
- https://dev.epicgames.com/documentation/en-us/unreal-engine/editor-utility-widgets-in-unreal-engine
- https://dev.epicgames.com/documentation/en-us/unreal-engine/scripting-the-unreal-editor-using-python
- https://dev.epicgames.com/documentation/en-us/unreal-engine/runtime-virtual-texturing-in-unreal-engine
- https://dev.epicgames.com/documentation/en-us/unreal-engine/runtimevirtual-texturing-quick-start-in-unreal-engine
- https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/MaterialEditingLibrary
- https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/RuntimeVirtualTextureFactory
- https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/EditorUtilityWidgetBlueprintFactory
