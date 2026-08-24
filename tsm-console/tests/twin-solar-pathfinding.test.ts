import { describe, expect, it } from 'vitest';
import { computeTwinSolarFloodTiles } from '../src/digital-twin/twin-solar-flood-tiles';
import { SpatialHash } from '../src/spatial/spatial-hash';
import { DStarLiteGrid, GridMap, aStar, jumpPointSearch, thetaStar } from '../src/pathfinding/grid-pathfinding';

function tiles(width: number, height: number) {
  return Array.from({ length: width * height }, (_, id) => ({
    id, x: id % width, y: Math.floor(id / width), terrainHeight: 0,
    sun_a_exposure: 0, sun_b_exposure: 0, total_solar_yield: 0,
  }));
}

describe('Twin Solar Flood Tiles', () => {
  it('propagates twin-source exposure on a 3x3 grid', () => {
    const result = computeTwinSolarFloodTiles(tiles(3, 3),
      { azimuthRadians: 0, elevationRadians: Math.PI / 4, intensity: 1 },
      { azimuthRadians: Math.PI, elevationRadians: Math.PI / 6, intensity: 0.5 });
    expect(result.tiles).toHaveLength(9);
    expect(result.tiles.some((tile) => tile.total_solar_yield > 0)).toBe(true);
    expect(result.tiles.every((tile) => tile.sun_a_exposure >= 0 && tile.sun_a_exposure <= 1)).toBe(true);
    expect(result.tiles.every((tile) => tile.sun_b_exposure >= 0 && tile.sun_b_exposure <= 1)).toBe(true);
  });

  it('handles a 10x10 propagation workload without changing tile cardinality', () => {
    const result = computeTwinSolarFloodTiles(tiles(10, 10),
      { azimuthRadians: 0, elevationRadians: Math.PI / 3, intensity: 1 },
      { azimuthRadians: Math.PI, elevationRadians: Math.PI / 4, intensity: 1 });
    expect(result.tiles).toHaveLength(100);
    expect(result.dirtyTileIds).toHaveLength(100);
  });

  it('supports dirty-tile recalculation', () => {
    const result = computeTwinSolarFloodTiles(tiles(3, 3),
      { azimuthRadians: 0, elevationRadians: Math.PI / 4, intensity: 1 },
      { azimuthRadians: Math.PI, elevationRadians: Math.PI / 4, intensity: 1 }, new Set([4]));
    expect(result.dirtyTileIds).toEqual([4]);
    expect(result.tiles[0].total_solar_yield).toBe(0);
  });
});

describe('Spatial Hash', () => {
  it('inserts, queries and removes objects by spatial cell', () => {
    const hash = new SpatialHash<{ x: number; y: number; z: number }>(2);
    const point = { x: 1, y: 1, z: 0 };
    hash.insert(point);
    expect(hash.queryRadius({ x: 1, y: 1, z: 0 }, 0.1)).toEqual([point]);
    expect(hash.remove(point)).toBe(true);
    expect(hash.size).toBe(0);
  });
});

describe('Grid pathfinding', () => {
  it('finds routes with A*, JPS and Theta*', () => {
    const grid = new GridMap(10, 10, Array(100).fill(true));
    const start = grid.node(0, 0)!; const goal = grid.node(9, 9)!;
    expect(aStar(grid, start, goal).path.length).toBeGreaterThan(0);
    expect(jumpPointSearch(grid, start, goal).path.length).toBeGreaterThan(0);
    expect(thetaStar(grid, start, goal).path.length).toBeGreaterThan(0);
  });

  it('repairs a route after a dynamic obstacle update', () => {
    const grid = new GridMap(10, 10, Array(100).fill(true));
    const start = grid.node(0, 0)!; const goal = grid.node(9, 9)!;
    const dStar = new DStarLiteGrid(grid, start, goal);
    expect(dStar.computePath().path.length).toBeGreaterThan(0);
    dStar.updateObstacle(5, 5, false);
    expect(dStar.computePath().path.length).toBeGreaterThan(0);
  });
});
