# Blender 3D Tiles and NSRS modernization adoption (2026-11-13)

## Source review
- Blender 5.3 (TechSpot, 2026-11-10): https://www.techspot.com/downloads/638-blender.html . Native Gaussian-splat PLY/SPZ/glTF import and rendering are authoring features, **not** geospatial registration, source accuracy, or UE5.8 Shipping evidence. Obtain Blender from the Blender Foundation, verify version and checksums; do not silently bundle the GPL application with the native runtime.
- Iconem blender_ogc3dtiles v0.5.1 (MIT): https://github.com/Iconem/blender_ogc3dtiles/releases/tag/v0.5.1 ; article https://radiancefields.com/iconem-streams-gaussian-splat-3d-tiles-into-blender . Camera-driven streaming supports local/network OGC 3D Tiles. Gaussian-splat support requires `KHR_gaussian_splatting` in glTF; SPZ compression may require optional Cesium Native Python wheel. No implied compatibility with arbitrary .splat, RAD, LCC or SOG streams. Check add-on and wheel SHA-256, wheel platform compatibility, and license before optional local installation. Avoid implicit network fetches in offline testing.
- NOAA NSRS: https://oceanservice.noaa.gov/geodesy/road-to-modernization.html (updated 2026-09-23). September 15 beta DDS/NCAT/OPUS-Static products are **not authoritative for operational use**. NGS states a January 13, 2027 cutoff for new submissions to the current OPUS workflow; confirm affected workflow directly with NGS before scheduling survey work.

## Recommended integration points
1. Keep Blender and Iconem as **optional authoring/inspection tools**, not TSM's Windows 11 offline runtime dependency. Existing `tools/geospatial_exchange/blender_validate.py` and `scripts/3d-tiles/bake-pbr-standard.py` remain primary Blender hooks.
2. For local tilesets, run the offline 3D Tiles reference auditor (merged PR #578). Its bounded traversal now checks explicit content, OGC 3D Tiles 1.1 implicit subtree availability and local GLB resource references; this is **static dependency integrity**, not complete glTF semantic validation, full published-dataset execution, or headed UE Shipping runtime proof. The actual distributed tilesets must be audited before any offline package-completeness claim.
3. Require an asset receipt with source URI, license, source SHA-256, acquisition/publication/retrieval times where known, CRS/horizontal reference frame, vertical datum, coordinate epoch, units, original scene origin, exact ECEF/ENU transform, asset type (mesh/point cloud/splat), Blender and plugin versions, and an `authority_class` plus `visualization_only=true`. Do not fill missing geodetic metadata with assumed defaults.
4. Preserve TSM's **NAD83(2011) / NAVD88 / GEOID18** production chain. Add a parallel `EXPERIMENTAL_BETA` comparison path for NATRF2022/SPCS2022/NAPGD2022 where supported; record transformation grids, interpolation method, epoch, source and target CRS, accuracy/residual, and input/output checksums. No beta value may overwrite FEMA BFE, flood levels, survey-grade coordinates, or authoritative layers.
5. Cross-check a small set of official NOAA geodetic control points with NCAT beta and existing TSM calculations; record numeric deltas and the full frame/epoch context. An apparent height offset is not an accuracy result without geoid and reference-frame alignment.
6. Use Blender to visually inspect LOD, roof-plane reconstruction, camera clipping, origin shifts and tile seams. Gaussian splats are photometric scene representations, **not** survey-certified surfaces or collision geometry; do not use them as hydraulic terrain or building footprints without separately validated geometry.
7. Preserve data licensing: Google Photorealistic 3D Tiles and Cesium ion have independent provider terms; do not automatically redistribute streamed assets in the public offline installer.

## Acceptance gates
- [ ] Source/version/license and wheel checksums pinned.
- [ ] Full local tileset dependency audit (including implicit subtrees and GLB resources) green.
- [ ] Blender headed screenshots and FPS/VRAM measurements with machine details captured.
- [ ] Receipt metadata and independent geodetic control comparisons attached.
- [ ] Beta transformation outputs excluded from operational/regulatory calculations.
- [ ] UE5.8 Shipping build and clean Windows 11 offline startup independently verified.

This is a research and integration decision record, not proof of installed Blender, verified 23,082 buildings, regulatory certification, or a packaged executable.
