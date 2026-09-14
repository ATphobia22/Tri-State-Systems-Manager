export type MartinTileSourceKind = 'vector' | 'raster' | 'terrain';

export interface MartinTileSource {
  readonly id: string;
  readonly kind: MartinTileSourceKind;
  readonly enabled: boolean;
}

export interface ThreeDTilesSource {
  readonly id: string;
  readonly tilesetUrl: string;
  readonly enabled: boolean;
}

const DEFAULT_MARTIN_BASE_PATH = '/tiles';

const SAFE_SOURCE_ID = /^[a-z0-9][a-z0-9-]{0,127}$/;

function requireSourceId(sourceId: string): string {
  if (!SAFE_SOURCE_ID.test(sourceId)) {
    throw new Error(`Invalid tile source id: ${sourceId}`);
  }
  return sourceId;
}

function requireHttpUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url, 'http://localhost');
  } catch {
    throw new Error('Invalid tile source URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Tile source URL must use HTTP or HTTPS.');
  }

  return url;
}

export function resolveMartinTileUrl(
  source: MartinTileSource,
  z: number,
  x: number,
  y: number,
  basePath = DEFAULT_MARTIN_BASE_PATH,
): string {
  requireSourceId(source.id);
  if (!source.enabled) throw new Error(`Tile source is disabled: ${source.id}`);
  if (!Number.isInteger(z) || z < 0 || z > 30) throw new Error('Invalid tile zoom.');
  if (!Number.isInteger(x) || x < 0) throw new Error('Invalid tile x coordinate.');
  if (!Number.isInteger(y) || y < 0) throw new Error('Invalid tile y coordinate.');
  if (!/^\/[a-zA-Z0-9._/-]*$/.test(basePath)) throw new Error('Invalid Martin base path.');

  return `${basePath.replace(/\/$/, '')}/${encodeURIComponent(source.id)}/${z}/${x}/${y}`;
}

export function resolveThreeDTilesetUrl(source: ThreeDTilesSource): string {
  requireSourceId(source.id);
  if (!source.enabled) throw new Error(`3D Tiles source is disabled: ${source.id}`);
  return requireHttpUrl(source.tilesetUrl);
}
