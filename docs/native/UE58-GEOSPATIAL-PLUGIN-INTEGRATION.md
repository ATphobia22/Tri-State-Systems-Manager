# UE5.8 geospatial plugin integration decision

This document describes **candidate** integrations, not completed Shipping validation. Run `python scripts/native/audit_ue58_plugins.py` for a static, network-free audit of the project plugin declarations. A PASS is **not** a successful Unreal build.

| Candidate | Decision | Integration boundary |
|---|---|---|
| [Cesium for Unreal](https://github.com/CesiumGS/cesium-unreal) | **Retain / validate** | Already declared in `TSMNative.uproject` and `TSMNative.Build.cs`; use pinned UE5.8-compatible release, locally staged authorized 3D Tiles and terrain; no required cloud services |
| Unreal built-in Georeferencing | **Evaluate as needed** | Geodetic/ECEF transforms must respect EPSG:2966, NAVD88, geoid model and unit conversions; do not mix ellipsoidal and orthometric heights |
| Unreal built-in PCG | **Editor prototype only** | Derived visual vegetation and street furniture from validated GIS geometry; do not fabricate roads, utilities, parcels, flood depths or building evidence |
| UE-GeoViewer | **Research / defer** | Verify exact upstream repository, license, UE5.8 support and raster CRS/NoData behavior before enabling |
| FWorldGenerator / TerraPrime | **Defer** | Synthetic terrain cannot replace authoritative lidar DEM/topobathy; evaluate only for explicitly synthetic scenes |
| [ProceduralDungeon](https://github.com/benpyton/proceduraldungeon) | **Not needed** | Rule-based room layout does not solve georeferenced civil infrastructure |
| Voxel Plugin | **Defer** | Check actual open-source licensing and UE5.8 compatibility; dynamic sculpting must not alter certified terrain or source datasets |
| FastNoiseUnreal | **Optional visuals only** | Noise can drive visual effects, never measured elevations, hydraulic results or authoritative source values |
| [UnrealSharp](https://github.com/unrealsharp/unrealsharp) | **Defer** | Extra .NET runtime, platform deployment and license/ABI validation not justified while existing C++/headless Python contracts suffice |
| UnrealEnginePython | **Do not add to Shipping** | Existing built-in `PythonScriptPlugin` is already Editor-only; perform GIS conversion in external headless Python pipeline |

## Mandatory acceptance gates before promoting any candidate

1. Identify canonical upstream URL, exact immutable revision, SPDX/license and any transitive dependencies.
2. Confirm Unreal **5.8** support, Win64 Shipping build and packaged-runtime compatibility on the authorized Windows runner.
3. Prove offline startup with networking disabled and **no localhost/WebView/Node requirement**; stage all content and verify SHA-256 manifests.
4. Keep source CRS, vertical datum, geoid, units, NoData, timestamp and original evidence ID; do not infer a datum from a scene origin.
5. Keep authoritative terrain/buildings and observed or modeled hydraulic results separate from synthetic visual dressing.
6. Capture headed screenshot/video and FPS/VRAM/hardware; exercise camera movement, World Partition streaming and local tileset loading.
7. Require human review before treating any screening result as a regulatory or engineering determination.

## Confirmed upstream compatibility

Cesium for Unreal **v2.31.0** provides a UE5.8 release package (CesiumForUnreal-58-v2.31.0.zip), according to its upstream releases page: https://github.com/CesiumGS/cesium-unreal/releases . Its plugin is Apache-2.0; hosted Cesium ion assets are not inherently available offline. Stage content with appropriate rights and verify loading from disk.

## Next implementation boundary

Prefer a **headless GIS preparation pipeline** (rasterio/GDAL, PROJ, tiled geometry and manifest checks) feeding the native C++ renderer. PCG may add decorative meshes around validated geometry but must not mutate the source-of-truth spatial layers. No third-party plugin is automatically installed or enabled by this document.
