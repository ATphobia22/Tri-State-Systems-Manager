# 3D terrain streaming architecture (TSM)

## Purpose

Deliver continuous terrain to web and native clients without treating screening DEM as certified survey elevations.

## Components

1. **Source plane** — USGS 3DEP / National Map products; metadata + hashes retained.
2. **Derivation plane** — tile encode (Terrain-RGB, heightmap, optional 3D Tiles terrain); CRS/datum explicit.
3. **Distribution plane** — Pages XYZ, Martin/PMTiles, or native `TSMData` snapshot.
4. **Runtime plane** — MapLibre terrain, Cesium terrain/tileset, UE landscape/World Partition.
5. **Composition plane** — NFHL, parcels, stage HUD, scenario overlays with authority badges.

## Data flow

See `docs/LOCAL-RUN-AND-3D-TERRAIN-STREAMING.md`.

## Non-goals

- Auto LOMA from terrain pixels
- Silent vertical datum shifts
- Committing full county LAS into Git

## Related

- `docs/3DEP-DATA-OPERATIONS.md`
- `docs/3D-TILES-CITYGML-PIPELINE.md`
- `packages/geo/src/cinema/CinematicEngineeringModel.ts`
