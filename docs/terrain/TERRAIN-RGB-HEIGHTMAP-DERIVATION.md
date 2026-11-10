# Terrain-RGB / Terrarium heightmap derivation

## Why RGB heightmaps

Full DEMs (GeoTIFF/LAS) are large. For interactive 3D, elevations are **encoded into ordinary PNG tiles** so CDNs and MapLibre/Cesium can stream them like imagery.

TSM treats these as **DERIVED screening** surfaces (see `docs/3DEP-DATA-OPERATIONS.md`).

## Terrarium (Mapzen / Tilezen) — common with 3DEP-derived stacks

Decode:

```text
height_m = (R × 256 + G + B / 256) − 32768
```

- R, G, B ∈ [0, 255]
- Offset 32768 allows negative (ocean) and positive land heights in one 24-bit-ish packing
- Practical precision ~1/256 m in the blue channel term

Encode: reverse the formula; clamp channels to 0–255.

**Implementation:** `packages/geo/src/terrain/TerrainRgbCodec.ts`

## Mapbox Terrain-RGB

Decode:

```text
height_m = −10000 + (R × 256² + G × 256 + B) × 0.1
```

- Interval 0.1 m
- Wide range suitable for global terrain

## Derivation pipeline (3DEP → tile)

1. Obtain 3DEP (or NED mosaic) for the AOI; record horizontal CRS and vertical datum.
2. Reproject/resample to Web Mercator tile grid at target zooms (only if required for the client).
3. For each pixel, convert orthometric/ellipsoidal height **as defined by the product** into meters for the codec (do not invent datum shifts).
4. Encode to RGB; write PNG XYZ or PMTiles.
5. Publish `tiles.json` / attribution; store SHA-256 of tile sets.
6. Client decodes RGB → meters → display feet if needed (`× 3.280839895`).

## What this is not

- Not a PE survey of LAG/BFE
- Not automatic NAVD88 certification
- Not a substitute for NFHL/FIRM water-surface elevations

## Related code

- Codec: `packages/geo/src/terrain/TerrainRgbCodec.ts`
- Stream contracts: `packages/geo/src/cinema/CinematicEngineeringModel.ts`
- Ops: `docs/3DEP-DATA-OPERATIONS.md`
