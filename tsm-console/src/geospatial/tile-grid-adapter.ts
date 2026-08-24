import type { Tile } from '../digital-twin/twin-solar-flood-tiles';
import type { TerrainGrid } from './terrain-grid';

export function terrainGridToSolarTiles(grid: TerrainGrid): readonly Tile[] {
  return Array.from({ length: grid.width * grid.height }, (_, id) => {
    const x = id % grid.width;
    const y = Math.floor(id / grid.width);
    return {
      id,
      x,
      y,
      terrainHeight: grid.elevations[id],
      walkable: true,
      sun_a_exposure: 0,
      sun_b_exposure: 0,
      total_solar_yield: 0,
    };
  });
}

export function terrainGridTileDimensions(grid: TerrainGrid): { tileWidth: number; tileHeight: number } {
  return {
    tileWidth: (grid.bounds[2] - grid.bounds[0]) / Math.max(1, grid.width - 1),
    tileHeight: (grid.bounds[3] - grid.bounds[1]) / Math.max(1, grid.height - 1),
  };
}
