import {
  cellToBoundary,
  cellToLatLng,
  gridDisk,
  isValidCell,
  latLngToCell,
} from 'h3-js';

export interface H3CellSummary {
  readonly cell: string;
  readonly resolution: number;
  readonly center: readonly [number, number];
  readonly boundary: ReadonlyArray<readonly [number, number]>;
}

function requireCoordinate(value: number, name: string, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
}

export function toH3Cell(
  latitude: number,
  longitude: number,
  resolution: number,
): string {
  requireCoordinate(latitude, 'latitude', -90, 90);
  requireCoordinate(longitude, 'longitude', -180, 180);

  if (!Number.isInteger(resolution) || resolution < 0 || resolution > 15) {
    throw new Error(`Invalid H3 resolution: ${resolution}`);
  }

  return latLngToCell(latitude, longitude, resolution);
}

export function summarizeH3Cell(cell: string): H3CellSummary {
  if (!isValidCell(cell)) {
    throw new Error('Invalid H3 cell index.');
  }

  const center = cellToLatLng(cell);
  const boundary = cellToBoundary(cell);

  return {
    cell,
    resolution: Number.parseInt(cell.slice(1, 2), 16),
    center: [center[0], center[1]],
    boundary: boundary.map(([latitude, longitude]) => [latitude, longitude]),
  };
}

export function h3Neighborhood(cell: string, ringDistance: number): string[] {
  if (!isValidCell(cell)) {
    throw new Error('Invalid H3 cell index.');
  }
  if (!Number.isInteger(ringDistance) || ringDistance < 0 || ringDistance > 20) {
    throw new Error('H3 ring distance must be an integer between 0 and 20.');
  }

  return gridDisk(cell, ringDistance);
}
