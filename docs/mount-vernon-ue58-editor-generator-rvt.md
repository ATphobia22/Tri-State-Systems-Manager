# Mount Vernon 47620 UE5.8 Editor Generator and Two-RVT Materials

Status: SOURCE IMPLEMENTATION; NOT_EVIDENCED in headed Unreal 5.8, Windows Shipping or 60 FPS. No .uasset or .umap is generated inside GitHub. The Editor bootstrap creates those assets on an authorized workstation.

## Existing TSM source constraints

The existing preview DEM sources are documented in docs/mount-vernon-terrain-real-dem-ue58-integration.md as EPSG:2968 and partial-area; vertical units/datum are unresolved. Do not assert EPSG:2966, NAVD88, complete area coverage, or exact mesh position without datum and independent anchor evidence.

The GIS preprocessor is headless and upstream of this editor tool. It must use reviewed GDAL/PROJ/LAS metadata before exporting three local-centimeter vector files: buildings.geojson (simple Polygon Feature), roads.geojson (LineString Feature) and trees.geojson (Point Feature). Include immutable feature ID, height/eave and width only where evidence exists. The prepared coordinate frame is EAST_SOUTH_UP: X= (easting-anchor_easting)*cm_per_unit; Y=-(northing-anchor_northing)*cm_per_unit, Z tied to a confirmed vertical reference. US survey foot conversion is 30.48006096cm; meter is 100cm. Elevations cannot be inferred from horizontal CRS. Avoid class-1 point cloud returns as roofs or guessed roof/eave fallback values.

Create a manifest after reprojection; example anchor numbers BELOW ARE NOT VERIFIED controls:

    python scripts/geospatial/tsm_mv_scene_manifest.py C:\TSMData\MountVernonScene --source-crs EPSG:2968 --anchor-x 500000 --anchor-y 1000000 --units us_survey_foot --vertical-datum UNVERIFIED

The tool creates manifest.json once, pins SHA-256 of all three files and validates IDs, geometry, finite local coordinates and the declared CRS. Failures do not silently skip unknown buildings or holes. Source reconciliation must happen upstream.

For Landscape import, 4033x4033 pixels correspond to 4032 vertex intervals. An 8km width means XY interval 800000/4032 = 198.412698cm. GDAL must align output raster pixel CENTERS to Landscape vertices (not simply from_bounds pixel edges). 16-bit Landscape height is centered near 32768 and requires explicit Z origin and Z-scale; never use arbitrary 0-65535 min-to-max as absolute NAVD88 height. Reject significant DEM NoData and perform independent corner/center elevation checkpoint QA.

## One-click Editor Utility Widget

1. Use TSMNative.uproject with UE5.8, MSVC and compiled TSMNativeEditor. PCG and Blutility enabled; PythonScriptPlugin is Editor-only.
2. Open and save a partitioned map and inspect actual CesiumGeoreference and Landscape. Existing map creator: tsm-native/Tools/Create-World-Partition-Map.py.
3. Set TSM_MV_SCENE_DIR to the local manifest directory before Editor startup.
4. Tools > Mount Vernon Town Generator, or run in UE Python console: import tsm_mv_widget; tsm_mv_widget.open_panel().
5. The script creates and saves the Editor Utility Widget Blueprint /Game/TSM/MountVernon/Editor/EUW_TSM_MountVernon. It binds Validate Inputs, Generate Town + RVT and RVT Materials buttons for that session.
6. Generate validates the whole local manifest before spawning source-linked C++ TSMGeoSplineActor actors and optional tree points. It creates RVT assets and starter materials, skips same-manifest loaded IDs and rejects conflicts. Unloaded World Partition cells are NOT covered by the duplicate check; inspect all cells before rerun. Save/review the level.

The importer is an input geometry staging tool, not a finished PCG graph or a roof/road mesh baker. PCG_MV_Buildings should read GeometrySpline and source properties, project to reviewed terrain, use source heights only, and bake verified static Nanite/HLOD meshes. PCG_MV_Roads should adaptively sample road splines with source width, project to terrain and author VertexColor.R from 0 at outer road edges to 1 in the center. PCG_MV_Trees should use instanced point data rather than huge per-tree actor counts. Mark candidates as derived, not surveyed species or buildings.

## Dual RVT topology

RVT_MountVernon_Material: BASE_COLOR_NORMAL_SPECULAR UE5.8 RVT type (color, normal, roughness and specular).
RVT_MountVernon_Height: WORLD_HEIGHT type, R16_UNORM normalized over volume min/max Z.

M_MV_Landscape_RVT_Starter: ordinary visible landscape shading plus RVT Output pins BaseColor, Normal, Roughness, Specular, WorldHeight; diagnostic flat color only.
M_MV_Road_RVT_Starter: samples both surface and worldheight RVTs. Lerp from landscape color/roughness at VertexColor.R=0 to asphalt at R=1, with MaxContactDeltaCM=20 requiring mesh-ground contact.
M_MV_Foundation_RVT_Starter: world-relative height mask alpha = saturate((PixelWorldZ - sampled_ground_Z)/35)^1.5. Ground contact adopts 0.75x landscape color and high contact roughness; above 35cm uses masonry placeholder color. No invalid world/tangent normal blending.

The automation creates TWO RVT Volume actors tagged BOUNDS_UNVERIFIED. You must select the reviewed Landscape in each Volume's Transform from Bounds panel, click Set Bounds, and attach BOTH RVTs to the Landscape Render to Virtual Textures list. Keep Landscape in Main Pass. Do NOT configure buildings or roads to write into the RVT that they sample; no read/write feedback loops. Bind the material instances to actual source meshes. Review virtual height accuracy against real ground survey check points.

A 1024 tile x 256px setting is a 262144px-wide VIRTUAL address space, not a promised 60 FPS or a valid VRAM budget. Suggested starting profile for an 8km region: 256 tiles x 128px = 32768 virtual texels per side (~24.4cm per texel) with 4px borders. Profile on real hardware before increasing; use stat virtualtexturing and stat virtualtexturememory. Road 15cm feathering should come from vertex colors/geometry instead of assuming 3cm RVT texels on every tile. WorldHeight precision depends on the volume Z span (approximate LSB=span_cm/65535); source vertical precision/datum is a separate issue. Use appropriate low mip streaming for verified large areas.

## Unfinished runtime work, not hidden by green static CI

PCG graph assets, Geometry Script roof bakes, custom PBR brick textures and hero landmarks, HLOD material bakes, foliage wind, seasonal MPC, sky and camera Blueprints, water material, Mass traffic, river barges, HUD, soundscapes, demo footage and offline Windows Shipping remain independent implementation/verification tasks. Weather, river stages, solar time, traffic and elevation labels must not masquerade as measured if simulated. Mount Vernon (Posey County) observes America/Chicago with DST; do not hardcode UTC-6 year-round.

Run Python unit/syntax tests in CI; execute material compiler, RVT on/off headed screenshots, GPU/VRAM/FPS, all asset/shader compile logs, World Partition streaming and clean network-disabled Windows 11 Shipping acceptance separately before considering a merge to main.

References:
https://dev.epicgames.com/documentation/en-us/unreal-engine/runtime-virtual-texturing-in-unreal-engine
https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/RuntimeVirtualTextureMaterialType
https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/EditorUtilityLibrary
https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/MaterialEditingLibrary


## Cinematic Material Parameter Collection & five editor presets

The Editor Utility Widget also offers Prepare Environment MPC and five **visual-only** preset buttons. The code constructs and saves MPC_MountVernon_Environment containing scalar SeasonProgress (default 0.35), SurfaceWetness (0.0), RiverMistDensity (0.25) and vector WindDirectionAndSpeed (normalized XY 0.85/0.52, A=0.35). Each preset button applies these parameter values to the open Editor world using KismetMaterialLibrary; it does NOT animate the weather, wind WPO, Niagara, Lumen, lighting, traffic or river levels until corresponding materials and controller assets are authored.

The five presets are RiverMist_Dawn, Summer_HighNoon, Autumn_GoldenHour, StormFront_Dusk and Winter_BlueHour. All have weather_provenance=CINEMATIC_NOT_OBSERVED, no claimed solar elevation or measured lux. Mount Vernon observes America/Chicago; January is UTC-6, July is UTC-5. Before capturing a geographically accurate sun position, bind SunSky/Sun Position Calculator to the source location, local date/time, DST flag and reviewed world-north orientation. The existing user's quoted sun elevations are illustrative and cannot substitute ephemeris output.

Material graphs must import the MPC parameters into real foliage, brick/road wetness, fog and water shaders to make them visually functional. For foliage WPO/TSR/VSM performance, profile disabling WPO after a selected distance rather than assuming a fixed 85m threshold or claiming 60 FPS. Runtime UMG camera/weather controls, traffic, crowds, soundscapes and barge effects remain future native work.
