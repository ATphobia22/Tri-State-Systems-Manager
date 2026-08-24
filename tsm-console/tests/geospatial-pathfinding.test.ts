import { describe, expect, it } from 'vitest';
import { aStar } from '../src/pathfinding/grid-pathfinding';
import { terrainGridToPathfindingGrid } from '../src/geospatial/pathfinding-terrain-adapter';
import type { TerrainGrid } from '../src/geospatial/terrain-grid';

describe('terrain-derived pathfinding grid', () => {
  it('blocks terrain steps above the configured threshold', () => {
    const grid: TerrainGrid = {
      width: 3,
      height: 3,
      bounds: [2680000, 940000, 2685000, 945000],
      elevations: new Float32Array([
        340, 340, 340,
        340, 350, 340,
        340, 340, 340,
      ]),
      crs: 'EPSG:2966',
      verticalDatum: 'NAVD88',
      source: 'INDIANA_2016_2020_DEM',
    };
    const result = terrainGridToPathfindingGrid(grid, 3);
    expect(result.grid.node(1, 1)?.walkable).toBe(false);
    const start = result.grid.node(0, 0)!;
    const goal = result.grid.node(2, 2)!;
    expect(aStar(result.grid, start, goal).path.length).toBeGreaterThan(0);
  });
});
