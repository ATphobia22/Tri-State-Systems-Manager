import { describe, expect, it } from 'vitest';
import { computeTwinSolarFloodTiles } from '../src/digital-twin/twin-solar-flood-tiles';
import { terrainGridToSolarTiles, terrainGridTileDimensions } from '../src/geospatial/tile-grid-adapter';
import type { TerrainGrid } from '../src/geospatial/terrain-grid';

describe('geospatial to Twin Solar Flood Tiles integration', () => {
  const grid: TerrainGrid = {
    width: 3,
    height: 3,
    bounds: [2680000, 940000, 2685000, 945000],
    elevations: new Float32Array([
      340, 341, 342,
      341, 342, 343,
      342, 343, 344,
    ]),
    crs: 'EPSG:2966',
    verticalDatum: 'NAVD88',
    source: 'INDIANA_2016_2020_DEM',
  };

  it('copies source-derived NAVD88 terrain into solar tiles', () => {
    const tiles = terrainGridToSolarTiles(grid);
    expect(tiles[0].terrainHeight).toBe(340);
    expect(tiles[8].terrainHeight).toBe(344);
    expect(terrainGridTileDimensions(grid)).toEqual({ tileWidth: 2500, tileHeight: 2500 });
  });

  it('keeps exposure normalized while intensity scales total solar yield', () => {
    const tiles = terrainGridToSolarTiles(grid);
    const result = computeTwinSolarFloodTiles(
      tiles,
      { azimuthRadians: 0, elevationRadians: Math.PI / 2, intensity: 2 },
      { azimuthRadians: Math.PI, elevationRadians: Math.PI / 2, intensity: 0 },
      undefined,
      { falloff: 0.85, propagationSteps: 1, maxRayDistance: 1, tileWidth: 2500, tileHeight: 2500 },
    );
    expect(result.tiles[4].sun_a_exposure).toBe(1);
    expect(result.tiles[4].total_solar_yield).toBe(2);
  });
});
