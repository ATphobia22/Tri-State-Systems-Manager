# TSM Unreal Engine 5.8: World Partition and offline Cesium 3D Tiles

Status: Native runtime prefetch implementation and workstation build tooling.
The project-owned UE5.8 binary map is NOT committed by this change.
Do not claim that the engine OpenWorld template is a packaged TSM map.

## Ownership and load boundaries

- World Partition: native Landscapes, roads, levees, static infrastructure,
  native HLOD meshes, and explicitly configured scenario Data Layers.
- Cesium for Unreal: OGC 3D Tiles building hierarchy and local tile cache,
  imagery, screen-space-error-driven selection and Cesium georeference.
- TSM evidence kernel: source records, source IDs, datum/CRS transformations,
  uncertainty, human review, recorded artifacts and SHA-256 hashes.

Cesium tileset/georeference/camera managers belong in the persistent world
with Is Spatially Loaded disabled. Do not duplicate tileset GLBs as native
World Partition streaming actors or count HLOD proxy actors as source buildings.
A complete 23,082-feature count requires a separate authoritative ID audit.

## Streaming prefetch

The native GameMode creates ATSMWorldPartitionStreamingAnchor only when
UWorld::GetWorldPartition() exists. Its WorldPartitionStreamingSourceComponent
starts disabled so it will not pin the cells at the origin.

Call GetStreamingAnchor()->PrefetchAtUnrealLocation(UnrealDestinationCm)
for a cinematic camera fly-to / teleport, check IsPrefetchReady() before
moving, and call CancelPrefetch() when normal player streaming is ready.
All arguments are Unreal-local centimeters after double-precision geodetic
conversion. Never pass EPSG:2966 projected US survey feet or raw NAVD88 heights.

Start with one runtime grid. Profile 25,600-51,200 cm grid cells and
approximately 1-2 km runtime loading distances on real Windows hardware.
These are candidate tuning values, not measured performance settings.

## Generate the missing Unreal binary map on the real workstation

1. Open tsm-native/TSMNative.uproject with Unreal Engine 5.8 and a compatible
   Cesium for Unreal plugin. In File > New Level select Open World, save the
   project-owned map as /Game/Maps/TSMRegion.
2. Confirm World Settings > World Partition > Enable Streaming. Create native
   Data Layers for roads, levees, infrastructure and scenario overlays. Save
   the map, HLOD layer assets, One File Per Actor packages and dependencies.
3. Alternatively, use the included editor script
   Tools/Create-World-Partition-Map.py with UE5.8 PythonScriptPlugin.
   The optional -GenerateMap switch uses the documented
   LevelEditorSubsystem.new_level(is_partitioned_world=True) API and
   never overwrites an existing map.
4. With UE_5_8_ROOT pointing at the installed engine, execute:
   pwsh -File tsm-native/Tools/Prepare-WorldPartition.ps1 -GenerateMap -BuildHLODs -AdoptAsDefaultMap
   This explicitly refuses to switch the default map when the binary map is
   missing or the HLOD commandlet fails.
5. Commit the .umap, external actor assets and DefaultEngine.ini, and package
   through tsm-native/Build-Windows.ps1. Confirm the map was cooked into the
   Windows 11 Shipping package. Internet access is for source updates only.

This GitHub connection can commit text scripts/C++ but cannot fabricate
compiled UE map assets, execute the UE5.8 Windows editor, or certify a
shipping .exe. Those acceptance stages require the licensed local toolchain.

## Release tests

- Prefetch toggles only in a World Partition level; non-WP maps do not crash.
- No native prefetch source pins the origin while inactive.
- Georeferenced tiles remain aligned while native actors load/unload; test
  rapid navigation, cell boundaries, origin shifts and cinematic playback.
- Visible LOD1/2 geometry does not imply engineering-grade lidar heights.
- The complete building source ID/height and packaged SHA-256 acceptance
  chain remains separate and mandatory before declaring countywide coverage.
- Validate packaged offline startup on Windows 11 x64 with real cinematic
  frames; the source-level CI smoke tests cannot replace this.

## Documentation

- https://dev.epicgames.com/documentation/en-us/unreal-engine/world-partition-in-unreal-engine
- https://dev.epicgames.com/documentation/en-us/unreal-engine/world-partition-builder-commandlet-reference
- https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/WorldPartitionStreamingSourceComponent
- https://cesium.com/learn/cesium-unreal/ref-doc/changes.html
