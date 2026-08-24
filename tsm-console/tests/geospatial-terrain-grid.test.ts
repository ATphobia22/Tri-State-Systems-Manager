import { describe, expect, it } from 'vitest';
import { elevationAt, sampleTerrainGrid } from '../src/geospatial/terrain-grid';
import type { TerrainRaster } from '../src/geospatial/terrain-raster';

describe('source-derived terrain grid', () => {
  const raster: TerrainRaster = {
    width: 4,
    height: 3,
    bounds: [2680000, 940000, 2685000, 945000],
    elevations: new Float32Array([
      340, 341, 342, 343,
      344, 345, 346, 347,
      348, 349, 350, 351,
    ]),
    crs: 'EPSG:2966',
    verticalDatum: 'NAVD88',
  };

  it('preserves georeferencing metadata and deterministic samples', () => {
    const grid = sampleTerrainGrid(raster, 2, 2);
    expect(grid.crs).toBe('EPSG:2966');
    expect(grid.verticalDatum).toBe('NAVD88');
    expect(grid.bounds).toEqual(raster.bounds);
    expect(Array.from(grid.elevations)).toEqual([340, 343, 348, 351]);
  });

  it('returns the source-derived elevation at a grid cell', () => {
    const grid = sampleTerrainGrid(raster, 4, 3);
    expect(elevationAt(grid, 2, 1)).toBe(346);
  });
});
