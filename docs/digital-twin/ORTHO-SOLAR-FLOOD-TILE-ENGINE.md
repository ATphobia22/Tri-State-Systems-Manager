# PTDT Orthophoto / Solar / Flood / Tile Engine

## Implemented

- Metadata-driven GeoTIFF inspection in `tsm-console/ops/ortho_processor.py`.
- Deterministic solar-position calculation in `tsm-console/src/digital-twin/solarEngine.ts`.
- Provenance-aware flood scenario model in `tsm-console/src/digital-twin/floodScenario.ts`.
- Unified orthophoto + flood-depth + solar WebGPU shader in `tsm-console/src/digital-twin/ultimateTwinPipeline.wgsl`.
- Local XYZ/MBTiles tile server in `tsm-console/ops/tile_server.py`.
- PWA manifest at `tsm-console/public/manifest.json`.
- Solar invariant tests in `tsm-console/tests/solar-engine.test.mjs`.

## Source-data rule

The renderer must not encode assumed BFE, 500-year, or 1937 elevations. Those values belong in verified scenario assets with source, CRS, vertical datum, model/run ID, and evidence ID.

The Indiana imagery integration is designed around the Indiana Geographic Information Office's statewide imagery catalog. The catalog provides yearly imagery as Cloud Optimized GeoTIFF and tiled products; the official service documentation also distinguishes cached imagery from dynamic access to source COG pixels.

## Runtime topology

```text
COG / LiDAR / MVT / MBTiles
          |
          v
     Local Tile Engine
          |
          +----> Terrain / Ortho textures
          |
          +----> Flood depth texture
          |
          v
       SceneState
          |
     +----+----+
     |         |
 SolarState  FloodScenario
     |         |
     +----+----+
          |
          v
      WebGPU renderer
```

## Security/performance constraints

- Bind the development tile server to `127.0.0.1` by default.
- Do not proxy arbitrary remote URLs through the tile server.
- Preserve CRS and vertical-datum metadata with every raster asset.
- Prefer COG/MBTiles and asynchronous tile loading over monolithic PNGs for valley-scale deployment.
- Keep flood depth authoritative; shader overlays are visualization, not hydraulic computation.
- Validate WGSL in CI with a standards-compliant WebGPU/WGSL validator before release.
