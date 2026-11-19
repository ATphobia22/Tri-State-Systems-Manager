# Mount Vernon GeoJSON / Unreal Engine 5.8 / Geofabrik

Source PR: experimental editor-only source code; native/headed UE5.8 Editor and Shipping validation remain **not evidenced**.

## Sources and evidence policy

- Main geospatial source for construction-grade buildings, roads and elevation: Indiana GIS, county survey, properly reviewed vertical datum/units. Preview DEM filenames do not prove an 8 x 8 km complete surface.
- Geofabrik / OpenStreetMap: **supplemental visual mapping only**, ODbL 1.0; include (c) OpenStreetMap contributors. Source links: https://download.geofabrik.de/north-america/us/indiana.html and https://docs.osmcode.org/osmium/latest/. The statewide PBF is roughly 192 MB at the time of research; the archive is not checked in.
- The Indiana snapshot is **not** a substitute for Indiana GIO road-centerline authority, FEMA, USGS or surveyed structure heights. Most OSM buildings have missing roof/material metadata. Avoid fabricated heights.
- Existing Google Drive project folder TSM-Posey-DEM contains 2026-11-19 elevation source inventory/status; transfers of full rasters remain incomplete. Separate OSM and survey/engineering layers.
- Always pin a **dated** source PBF and hash it, rather than changing latest symlink. Example indiana-261117.osm.pbf (date in name 2026-11-17). Check official MD5 from its exact archive path and independently compute SHA-256; record both in the data provenance ledger. Avoid placing huge archives in Git or committing any keys.

## Offline-headless ingestion on GIS build host (osmium / pyproj)

Download the dated PBF and matching MD5 file from the official Indiana index, validate MD5 and compute sha256sum. This execution session could not download files due to DNS network failure; no claim of complete snapshot download is made.

1. Set a Mount Vernon bounds box in WGS84 after reviewing the actual AOI (approximate illustration, not surveyed): -87.942,37.896,-87.849,37.969.
2. Clip the dated PBF with osmium extract --bbox=-87.942,37.896,-87.849,37.969 --strategy=complete_ways indiana-261117.osm.pbf -o mount-vernon.osm.pbf
3. Export with osmium export --attributes=type,id -f geojson mount-vernon.osm.pbf -o mount-vernon.geojson
4. Run python scripts/geospatial/prepare_geofabrik_ue_scene.py --geojson mount-vernon.geojson --out C:/TSMData/MountVernonOSM-261117 --bbox -87.942 37.896 -87.849 37.969 --crs EPSG:2966 --anchor-x YOUR_SURVEY_ANCHOR_X --anchor-y YOUR_SURVEY_ANCHOR_Y --units us_survey_foot.
5. Validate manifest/GeoJSON using python tsm-native/Content/Python/tsm_mv_scene_contract.py C:/TSMData/MountVernonOSM-261117. The converter deliberately rejects unsupported building holes/MultiPolygons, absent stable IDs, CRS mismatches and overwrites. Reconcile these in GIS before proceeding.
6. The converter does **not** attach heights; OSM has no justified DEM/roof-height relationship. Missing height remains visibly missing. Avoid mixing OSM street IDs with authoritative county road IDs.
7. For absolute licensing compliance when distributing derived OSM databases or packaged offline tiles, review the ODbL share-alike, attribution and extraction obligations with counsel. Store license/attribution notice alongside the snapshot.

## Unreal Editor generator

Build TSMNativeEditor for Windows with UE5.8 + MSVC. Enable PythonScriptPlugin, Blutility, EditorScriptingUtilities, PCG. Open a World Partition level. Set TSM_MV_SCENE_DIR to the local validated scene directory **before editor startup**. In the UE Python console run import tsm_mv_widget; tsm_mv_widget.open_panel(). Its dynamically created Editor Utility Widget Blueprint has buttons Validate Inputs, Generate Town + RVT, and Set Up RVT Materials. Actual clicked-widget and editor runtime execution are pending independent Windows runner validation; do not treat the script as a baked .uasset.

Generation imports checked source-linked ATSMGeoSplineActor carriers, not a complete photoreal town, roofs, PCG graphs, or a baked HLOD. Native actor properties carry FeatureId, SourceSha256, EvidenceStatus, GeometrySpline, optional height/width. Preserve missing evidence.

## RVT pair: surface + world height

The RVT generator creates two material types and volumes in /Game/TSM/MountVernon/Materials/RVT:
- RVT_MountVernon_Material: base color / normal / roughness / specular.
- RVT_MountVernon_Height: world height.
- M_MV_Landscape_RVT_Starter: diagnostic landscape color and world height output, not photogrammetry.
- M_MV_Road_RVT_Starter: samples landscape material and height, blends based on authored road vertex R and ground contact. No automatic road grading.
- M_MV_Foundation_RVT_Starter: uses actual pixel world Z minus RVT world-height for 35-cm foundation contact blend, never actor pivot as a substitute for elevation.

**Required visual/editor finishing steps**: compile starter expressions in UE5.8; set bounds on BOTH RVT volumes against source-validated Landscape; assign BOTH RVT assets to Landscape Render to Virtual Textures; assign writer landscape material and reader road/foundation materials; exclude roads/foundations from writing into same RVTs; build reviewed spline road meshes and PCG graph assets; test contact transitions at slopes; measure GPU streaming cache/page table before setting high virtual resolution. No 60 FPS guarantee.

Production acceptance additionally needs geometry/coverage reconciliation, exact horizontal and vertical datum proof, UE5.8 headed screenshots and runtime log, PCG generation, HLOD bake, UE Win64 Shipping BuildCookRun, and clean network-disabled Windows 11 startup.

## Reusable geospatial checks

The existing headless contract test is tests/test_tsm_mv_scene_contract.py and the scoped workflow is .github/workflows/mount-vernon-editor-generator.yml. Editor API and RVT runtime require a Windows UE5.8 runner; passing syntax/contract CI does not satisfy those release gates.
