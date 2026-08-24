import type { TerrainRaster } from './terrain-raster';

export interface TerrainGrid {
  readonly width: number;
  readonly height: number;
  readonly bounds: readonly [number, number, number, number];
  readonly elevations: Float32Array;
  readonly crs: 'EPSG:2966';
  readonly verticalDatum: 'NAVD88';
  readonly source: 'INDIANA_2016_2020_DEM';
}

export function sampleTerrainGrid(raster: TerrainRaster, targetWidth = 128, targetHeight = 128): TerrainGrid {
  if (!Number.isInteger(targetWidth) || targetWidth < 2 || targetWidth > 256) throw new RangeError('targetWidth must be 2..256');
  if (!Number.isInteger(targetHeight) || targetHeight < 2 || targetHeight > 256) throw new RangeError('targetHeight must be 2..256');
  if (raster.elevations.length !== raster.width * raster.height) throw new RangeError('terrain raster dimensions do not match elevation sample count');

  const elevations = new Float32Array(targetWidth * targetHeight);
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(raster.height - 1, Math.round((y / (targetHeight - 1)) * (raster.height - 1)));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(raster.width - 1, Math.round((x / (targetWidth - 1)) * (raster.width - 1)));
      elevations[y * targetWidth + x] = raster.elevations[sourceY * raster.width + sourceX];
    }
  }

  return {
    width: targetWidth,
    height: targetHeight,
    bounds: raster.bounds,
    elevations,
    crs: 'EPSG:2966',
    verticalDatum: 'NAVD88',
    source: 'INDIANA_2016_2020_DEM',
  };
}

export function elevationAt(grid: TerrainGrid, x: number, y: number): number {
  if (!Number.isInteger(x) || x < 0 || x >= grid.width) throw new RangeError('x is outside the terrain grid');
  if (!Number.isInteger(y) || y < 0 || y >= grid.height) throw new RangeError('y is outside the terrain grid');
  return grid.elevations[y * grid.width + x];
}
