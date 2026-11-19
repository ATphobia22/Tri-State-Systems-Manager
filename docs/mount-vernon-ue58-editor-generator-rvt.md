# Mount Vernon 47620: source-linked town generator and RVT materials (UE5.8)

Status: SOURCE IMPLEMENTATION, pending Windows editor and visual verification. This is not a certified 1:1 replica or a finished .umap, PCG graph, heightmap import, HLOD bake, or Win64 Shipping artifact.

## Existing TSM integration

The native Unreal project is at tsm-native/TSMNative.uproject. The source spline carrier ATSMGeoSplineActor is in TSMNative; its GeometrySpline and GIS properties are readable by Blueprint and authoring PCG. The Editor-only scripts are in tsm-native/Content/Python. The new PCG plugin is enabled; PythonScriptPlugin, EditorScriptingUtilities and CesiumForUnreal remain enabled; Blutility is Editor-only. Unreal C++ Editor target must compile on a UE5.8 Windows runner before the spline class is available.

Existing Mount Vernon DEM preview sources are documented at docs/mount-vernon-terrain-real-dem-ue58-integration.md, including DEM sources in EPSG:2968, unresolved vertical units/datum, and source hashes. They are only partial-area PREVIEW terrain. Do NOT relabel these as EPSG:2966, assert NAVD88, extrapolate the missing AOI, or present them as complete GIS coverage.

## 1. Prepare/source data (headless, not in Shipping)

Use GDAL/rasterio, GeoPandas/pyproj and optionally Laspy on the build workstation. Require original EPSG and vertical units from official source metadata; do not assume every Posey survey layer uses EPSG:2966. Select a stable surveyed projected origin; record easting, northing, horizontal CRS, units and independently reviewed vertical datum.

Transform building and road geometries into the explicitly declared local UE coordinate frame, X=(easting-anchor_easting)*cm_per_source_unit, Y=-(northing-anchor_northing)*cm_per_source_unit. UE coordinates are CENTIMETERS. If source CRS differs from selected output projection, reproject *first*. Do not invert Y twice. For non-flat surfaces, include per-point local Z in centimeters derived from a documented DEM/datum reference; otherwise two-element XY coordinates are permitted as a visual-only plane at Z=0 and MUST be projected in PCG before use. Never infer roof elevation from class 1/unclassified returns. Only derive indicative roof heights from building-class (class 6) points spatially inside the footprint when the LAS horizontal CRS, vertical units, and datum compatibility with DEM are documented. Record lidar samples/count and keep height unavailable when unsupported.

For a 4033x4033 Landscape use 4032 VERTEX intervals. If an 8 km region is mapped into 4033 vertices, XY scale is 800000 / 4032 = 198.412698... cm per interval. A raster sampled as pixel centers must sample exact Landscape vertex locations (the output affine must place pixel center 0 at the west/northmost Landscape vertex and pixel center 4032 at the east/southmost vertex); rasterio.from_bounds for 4033 pixels otherwise introduces half-pixel displacement. All incomplete NoData coverage must be explicitly rejected or segregated into tiles; never silently replace with minimum height. Epic defines decoded Landscape values at Z-scale=100 as approximately -256 to +256 meters centered on 32768. For a chosen source elevation minimum/maximum in centimeters, place the Landscape at Z=(minimum+maximum)/2 relative to the chosen vertical origin, use ZScale=(maximum-minimum)/512 (UE scale value, heights in cm), and encode 16-bit samples around 32768. Recheck UE import with surveyed control points and center/edge tests before authoring buildings. No single constant heightmap can represent a genuinely curved regional ground surface at global scale without projection distortion; use a local extent and georeferencing discipline.

Expected prepared files (all local, outside source control):
- buildings.geojson: GeoJSON simple Polygon Features; properties id, optional measured height_cm/eave_cm/roof_type; no default guessed height or roof
- roads.geojson: LineString Features; properties id, optional sourced width_cm
- trees.geojson: Point Features with stable id; canopy peaks are candidate tree anchors, NOT exact individual trees
- manifest.json: immutable file checksums and explicitly declared input CRS/origin/evidence status

The importer deliberately rejects MultiPolygons, buildings with holes, empty IDs, non-finite coordinates, out-of-bounds points, corrupted files or duplicate IDs. Split/repair geometries using a documented GIS tool before exporting. Do not drop unmatched buildings without a reported reconciliation count.

Create manifest after export (example, replace anchor values with surveyed numbers, never use the earlier sample anchor as verified):

    python scripts/geospatial/tsm_mv_scene_manifest.py C:\TSMData\MountVernonScene --source-crs EPSG:2968 --anchor-x 500000 --anchor-y 1000000 --units us_survey_foot --vertical-datum UNVERIFIED

The manifest generator refuses overwrite and validates all three payloads and hashes; anchor values above are EXAMPLES, not Mount Vernon control coordinates.

## 2. Build the one-click Editor Utility Widget

1. Run python scripts/configure_unreal_tools.py tsm-native/TSMNative.uproject if required, compile TSMNativeEditor in UE5.8 with MSVC and restart. Enable Blutility and PCG (new project descriptors include both).
2. Open/save a source-correct, partitioned map. Existing tool: tsm-native/Tools/Create-World-Partition-Map.py. If the startup map does not exist, do not claim it is present.
3. In the Windows process environment before launching Unreal, set TSM_MV_SCENE_DIR to the absolute local scene folder containing the manifest.
4. UE Editor loads Content/Python/init_unreal.py (PythonScriptPlugin), which adds Tools > Mount Vernon Town Generator. Or in Unreal's Python command console run: import tsm_mv_widget; tsm_mv_widget.open_panel()
5. The script creates and saves /Game/TSM/MountVernon/Editor/EUW_TSM_MountVernon as an actual Editor Utility Widget Blueprint. It instantiates the dockable widget and binds three UI buttons to Python callbacks for the current editor session.
6. Use Validate Inputs first. Generate Town + RVT validates, creates RVT starter assets, then creates geospatial spline carriers (buildings/roads) and optional tree targets, and saves the level. The same manifest re-import skips loaded matching identities; conflicting manifest identities refuse overwrite.
7. Review all imported features in the World Outliner and World Partition cells. The importer is additive and attempts actor rollback on spawn exceptions, but cannot undo material assets or guarantee rollback after editor crashes. Check unloaded WP cells before assuming global deduplication.
8. Use the RVT Materials button separately to create idempotent assets. This does not overwrite existing user materials.

The menu and dynamic Python delegate wiring rely on experimental Unreal Python APIs; verify after an editor restart. C++/Widget compilation and actual UI click handling are NOT_EVIDENCED by Python unit tests alone. The source-generated .uasset must be committed separately if a prebuilt widget is needed on a fresh cloned machine without running bootstrap.

## 3. Runtime Virtual Texture topology (no feedback)

RVT_MV_Surface (Base Color / Normal / Roughness) is the ONE LANDSCAPE writer target. Source-generated assets in /Game/TSM/MountVernon/Materials:

- M_MV_Landscape_RVT_Starter: both ordinary visible shading and Runtime Virtual Texture Output connected from its base color/roughness nodes. Starter colors are diagnostic, NOT orthophotography.
- M_MV_Road_RVT_Starter: Runtime Virtual Texture Sample from RVT_MV_Surface, then Lerp(A=landscape, B=asphalt, Alpha=VertexColor.R) for BASE COLOR. Road center vertex red must be 1; edges transition to 0 over authored feather width. Default white vertex colors produce full asphalt (no feather).
- M_MV_Foundation_RVT_Starter: Runtime Virtual Texture Sample from the same landscape RVT, then height-above-ActorPositionWS blended over the bottom 30 cm of the foundation; actor pivot must be at ground contact. Put RVT-sampled terrain in A, masonry color in B. The foundation should NOT write to the same RVT it samples.

Do not connect a road/foundation material to write into the SAME surface RVT it samples. A separate road-marking RVT could be introduced later if terrain must incorporate road imprints. Do not mix RVT world-height with BaseColor/Normal/Roughness asset types.

**Required manual UE editor finishing** (material assets and RVT volume alone are not enough):
1. Inspect/set RVT asset material type, resolution and physical tile settings for actual GPU budget; keep sample material type in sync.
2. Select the RVT Volume and use Set Bounds with the real Landscape. Volume creation alone does not establish coverage of the entire 8km region.
3. Set source Landscape to write RVT_MV_Surface and apply the landscape starter/master RVT material. Verify Render to Virtual Textures on relevant components. In editor visuals confirm the RVT responds to changes.
4. Put road meshes in the main pass, apply road material, author lane/edge VertexColor.R transitions, and ensure their component draw mode does NOT create a read/write feedback loop. Adapt the projected road spline mesh and sidewalk meshes in separate PCG graphs.
5. Apply foundation sample material only to the 0-30cm contact skirt (or to a building actor with pivot truly at grade). Architectural walls should use the final world-aligned brick/limestone PBR master material and sourced textures, not starter colors.
6. Use VT debugging modes and screenshot comparison with RVT enabled/disabled across varying slope, asphalt/grass contact and brick base. Benchmark cost and inspect grazing-angle artifacts.

## 4. PCG graph build contracts (Blueprint assets still require UE Editor authoring)

Buildings (PCG_MV_Buildings): Get Actor Data by MV_BUILDINGS tag (or class ATSMGeoSplineActor and FeatureKind=buildings), extract GeometrySpline, project footprint points to source Landscape, preserve FeatureId and SourceSha256 on generated outputs, branch only where HeightCm>0 and supporting evidence exists, select modular wall grammar by source attributes, and generate geometry with collision/winding and façade openings checked. Multi-ring buildings need a separate tessellation stage. RoofType=unknown must NOT be promoted into gable/flat: show placeholder volume and missing-height state. Bake reviewed mesh output into static Nanite assets by cell, never use a dynamic Geometry Script actor as a Shipping requirement.

Roads (PCG_MV_Roads): select MV_ROADS; sample spline with adaptive curvature and segment tangents; project to terrain, add the reviewed 2-4cm render-only Z bias, create SplineMesh per centerline segment, and use sourced width and road class when available. No automatic road cutting until right-of-way/contours are validated, and leave width unavailable rather than defaulting all roads to 6.5m. RVT edge blend uses VertexColor.R. Spawn sidewalk and street furniture only where inventory/imagery supports it; period props can be labeled artistic.

Trees (PCG_MV_Trees): select MV_TREES TargetPoints, project to terrain, use detected canopy height only when present. Use biome species as *cinematic candidates*, not surveyed species or exact tree inventory. For very large forests, switch to tiled HISM/PCG Point Data rather than >10,000 individual editor actors.

Hero landmarks: courthouse, riverfront and industrial terminals should use independently reviewed photography/footprints and licenses. No exact floodwall NAVD88 heights or façade claims without control measurements. Use physically calibrated brick/limestone/albedo/roughness values, local weather observations for time-specific lighting, sediment-appropriate river shading and published hydrology to drive any observed stage. Cinematic flow maps/foam are illustrative, not measurement.

## 5. Release gates

The scoped workflow mount-vernon-editor-generator.yml checks Python parsing and synthetic contract fixtures; it cannot prove 5.8 Python APIs execute, generated .uasset compiles, C++ UHT compiles, PCG graphs are connected, RVT materials render, landscape alignment is within tolerance or runtime meets 60 FPS.

Before declaring done, independently prove: surveyed anchor/CRS and vertical unit/datum, no gap in real DEM AOI, heightmap control point checks, all intended feature IDs with building count reconciliation, UE5.8 headed screenshots with RVT on/off, PCG meshing, HLOD bake, Win64 Shipping BuildCookRun, and fresh network-disabled Windows 11 launch with GPU/FPS/VRAM logs. Do not automatically merge into main until required checks and reviews pass.

Official references:
- https://dev.epicgames.com/documentation/en-us/unreal-engine/landscape-technical-guide-in-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/runtimevirtual-texturing-quick-start-in-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/runtime-virtual-texturing-in-unreal-engine
- https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/EditorUtilityLibrary
- https://dev.epicgames.com/documentation/en-us/unreal-engine/scripting-the-unreal-editor-using-python
