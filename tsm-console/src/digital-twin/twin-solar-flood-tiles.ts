export interface Tile {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly terrainHeight: number;
  readonly walkable?: boolean;
  readonly sun_a_exposure: number;
  readonly sun_b_exposure: number;
  readonly total_solar_yield: number;
}

export interface SolarSource {
  readonly azimuthRadians: number;
  readonly elevationRadians: number;
  readonly intensity: number;
}

export interface SolarFloodConfig {
  readonly falloff: number;
  readonly propagationSteps: number;
  readonly maxRayDistance: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
}

export interface SolarFloodResult {
  readonly tiles: readonly Tile[];
  readonly dirtyTileIds: readonly number[];
}

export const DEFAULT_SOLAR_FLOOD_CONFIG: SolarFloodConfig = {
  falloff: 0.85,
  propagationSteps: 32,
  maxRayDistance: 64,
  tileWidth: 1,
  tileHeight: 1,
};

const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function finitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be finite and positive`);
}

function finiteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and non-negative`);
}

function sourceVector(source: SolarSource): readonly [number, number, number] {
  const horizontal = Math.cos(source.elevationRadians);
  return [
    horizontal * Math.sin(source.azimuthRadians),
    horizontal * Math.cos(source.elevationRadians === Math.PI / 2 ? 0 : source.azimuthRadians),
    Math.sin(source.elevationRadians),
  ];
}

function directExposure(
  tile: Tile,
  source: SolarSource,
  byCoordinate: ReadonlyMap<string, Tile>,
  config: SolarFloodConfig,
): number {
  if (source.elevationRadians <= 0 || source.intensity <= 0) return 0;
  const [dx, dy, dz] = sourceVector(source);
  const horizontalMagnitude = Math.hypot(dx, dy);
  if (horizontalMagnitude < 1e-9) return 1;

  const stepX = dx / horizontalMagnitude;
  const stepY = dy / horizontalMagnitude;
  const steps = Math.min(config.maxRayDistance, Math.ceil(config.maxRayDistance / Math.max(config.tileWidth, config.tileHeight)));
  const slopePerStep = dz / horizontalMagnitude;
  let visibility = 1;

  for (let step = 1; step <= steps; step += 1) {
    const x = Math.round(tile.x + stepX * step);
    const y = Math.round(tile.y + stepY * step);
    const blocker = byCoordinate.get(`${x}:${y}`);
    if (!blocker) continue;
    const expectedHeight = tile.terrainHeight + slopePerStep * step;
    if (blocker.terrainHeight > expectedHeight + 1e-6) {
      visibility = 0;
      break;
    }
  }

  return clamp01(visibility * Math.sin(source.elevationRadians));
}

function propagate(
  direct: ReadonlyMap<number, number>,
  byId: ReadonlyMap<number, Tile>,
  byCoordinate: ReadonlyMap<string, Tile>,
  config: SolarFloodConfig,
): Map<number, number> {
  const result = new Map<number, number>(direct);
  const queue: Array<{ id: number; value: number; depth: number }> = [];
  for (const [id, value] of direct) if (value > 0) queue.push({ id, value, depth: 0 });

  let cursor = 0;
  while (cursor < queue.length) {
    const current = queue[cursor++];
    if (current.depth >= config.propagationSteps || current.value <= 1e-6) continue;
    const tile = byId.get(current.id);
    if (!tile) continue;

    for (const [ox, oy] of NEIGHBOR_OFFSETS) {
      const neighbor = byCoordinate.get(`${tile.x + ox}:${tile.y + oy}`);
      if (!neighbor) continue;
      const candidate = current.value * config.falloff;
      if (candidate > (result.get(neighbor.id) ?? 0)) {
        result.set(neighbor.id, candidate);
        queue.push({ id: neighbor.id, value: candidate, depth: current.depth + 1 });
      }
    }
  }
  return result;
}

export function computeTwinSolarFloodTiles(
  tiles: readonly Tile[],
  sunA: SolarSource,
  sunB: SolarSource,
  partialTileIds?: ReadonlySet<number>,
  config: SolarFloodConfig = DEFAULT_SOLAR_FLOOD_CONFIG,
): SolarFloodResult {
  finitePositive(config.falloff, 'falloff');
  if (config.falloff > 1) throw new RangeError('falloff must be <= 1');
  finitePositive(config.propagationSteps, 'propagationSteps');
  finitePositive(config.maxRayDistance, 'maxRayDistance');
  finitePositive(config.tileWidth, 'tileWidth');
  finitePositive(config.tileHeight, 'tileHeight');
  finiteNonNegative(sunA.intensity, 'sunA.intensity');
  finiteNonNegative(sunB.intensity, 'sunB.intensity');

  const byId = new Map(tiles.map((tile) => [tile.id, tile]));
  const byCoordinate = new Map(tiles.map((tile) => [`${tile.x}:${tile.y}`, tile]));
  const targetIds = partialTileIds && partialTileIds.size > 0 ? partialTileIds : new Set(tiles.map((tile) => tile.id));
  const directA = new Map<number, number>();
  const directB = new Map<number, number>();

  for (const tile of tiles) {
    if (!targetIds.has(tile.id)) continue;
    directA.set(tile.id, directExposure(tile, sunA, byCoordinate, config));
    directB.set(tile.id, directExposure(tile, sunB, byCoordinate, config));
  }

  const exposureA = propagate(directA, byId, byCoordinate, config);
  const exposureB = propagate(directB, byId, byCoordinate, config);
  const dirtyTileIds = Array.from(targetIds);
  const updated = tiles.map((tile) => {
    if (!targetIds.has(tile.id)) return tile;
    const a = clamp01(exposureA.get(tile.id) ?? 0);
    const b = clamp01(exposureB.get(tile.id) ?? 0);
    return { ...tile, sun_a_exposure: a, sun_b_exposure: b, total_solar_yield: a * sunA.intensity + b * sunB.intensity };
  });
  return { tiles: updated, dirtyTileIds };
}
