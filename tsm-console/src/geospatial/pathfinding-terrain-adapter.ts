import { GridMap } from '../pathfinding/grid-pathfinding';
import type { TerrainGrid } from './terrain-grid';

export interface TerrainPathfindingGrid {
  readonly grid: GridMap;
  readonly maxStepFt: number;
  readonly walkableCount: number;
}

export function terrainGridToPathfindingGrid(grid: TerrainGrid, maxStepFt = 3): TerrainPathfindingGrid {
  if (!Number.isFinite(maxStepFt) || maxStepFt <= 0) throw new RangeError('maxStepFt must be finite and positive');
  const walkable = new Array<boolean>(grid.width * grid.height).fill(true);

  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const index = y * grid.width + x;
      const elevation = grid.elevations[index];
      const neighbors: number[] = [];
      if (x > 0) neighbors.push(index - 1);
      if (x + 1 < grid.width) neighbors.push(index + 1);
      if (y > 0) neighbors.push(index - grid.width);
      if (y + 1 < grid.height) neighbors.push(index + grid.width);
      if (neighbors.some((neighborIndex) => Math.abs(grid.elevations[neighborIndex] - elevation) > maxStepFt)) walkable[index] = false;
    }
  }

  return {
    grid: new GridMap(grid.width, grid.height, walkable),
    maxStepFt,
    walkableCount: walkable.filter(Boolean).length,
  };
}
