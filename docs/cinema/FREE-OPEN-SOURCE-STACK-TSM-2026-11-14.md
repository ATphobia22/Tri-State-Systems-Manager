# Free / open stack for TSM twin + cinematic (research 2026-11-14)

Prices and AI limits change; verify licenses before commercial deploy.

## Geospatial / cityscape (authoritative path)

| Tool | Cost | Use for TSM |
|------|------|-------------|
| **Your Drive Posey tiles** | Free (owned) | 20,517 LOD1 height-verified 3D Tiles — reassemble tar.zst → host on Pages |
| **Cesium ion catalog** | Free tier + token | World Terrain 1, OSM Buildings 96188 |
| **py3dtilers / tyler / 3d-tiles-tools** | OSS | CityGML/CityJSON → 3D Tiles |
| **gltf-transform meshopt** | OSS | EXT_meshopt_compression |
| **digital-twin-toolbox** | GPL OSS | Shapefile/LAS → 3D Tiles pipelines |
| **awesome-3d-tiles** | Curated list | Viewers, converters |
| **MapLibre + 3d-tiles-renderer** | OSS | Web twin (already in TSM) |

## Cinematic / materials

| Tool | Cost | Notes |
|------|------|-------|
| **Quixel Megascans on Fab** | Free (full library as of ~12 Nov 2026) | Fab Standard License; AI training allowed under updated terms — verify current Fab listing |
| **Blender** | Free | Modeling, glTF 2.0 I/O, OCIO ACES |
| **Blender Studio open movies / characters** | Free learning | Shading/render techniques |
| **OpenUSD (Pixar)** | Open standard | Scene composition; Cesium/Omniverse bridge patterns |
| **DaVinci Resolve (free)** | Free tier | ACEScct project color science; grade cinematic twin exports |
| **OpenColorIO** | OSS | ACEScg linear pipeline with Natron/Blender |
| **Poly Haven / ambientCG** | CC0 | HDRIs, materials |

## Motion / VFX (optional cinematic plane only)

| Area | Free-leaning options |
|------|----------------------|
| Lip-sync | Several free tools (Percify list); quality varies |
| Markerless mocap | MetaHuman Animator plugin (Epic free tier constraints) |
| Edit | Resolve free; Blender VSE |

**TSM rule:** VFX/mocap stay on cinematic plane — never substitute for LOMA/gage/FIRM evidence.

## Finish checklist (still local)

1. Reassemble `posey-fixed-part01.tar.zst` → publish `tileset.json`  
2. Fix ion terrain: upload single GeoTIFF DEM (6155965 is DATA_ERROR)  
3. Wire twin URL to self-hosted Posey tiles  
4. Optional: Megascans materials in UE5.8 cinematic only  
5. Resolve ACES grade for Movie Render Queue exports  

## Non-claims

Oak Grove Slim and guide art are original. No Pixar IP. Free does not mean unlimited commercial in every jurisdiction — read Fab / Epic / Cesium terms.
