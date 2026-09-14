import type { ResolvedTileSource } from './geospatial-tile-sources';

export interface MapLibreTileCoordinate {
  readonly z: number;
  readonly x: number;
  readonly y: number;
}

const WEB_MERCATOR_HALF_WORLD = 20037508.342789244;
const WORLD_WIDTH = WEB_MERCATOR_HALF_WORLD * 2;

function clampLatitude(latitude: number): number {
  return Math.max(-85.05112878, Math.min(85.05112878, latitude));
}

export function tileBounds3857(tile: MapLibreTileCoordinate): readonly [number, number, number, number] {
  const n = 2 ** tile.z;
  const minX = -WEB_MERCATOR_HALF_WORLD + (tile.x / n) * WORLD_WIDTH;
  const maxX = -WEB_MERCATOR_HALF_WORLD + ((tile.x + 1) / n) * WORLD_WIDTH;
  const north = clampLatitude((180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - (2 * tile.y) / n))));
  const south = clampLatitude((180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - (2 * (tile.y + 1)) / n))));
  const maxY = (Math.log(Math.tan(Math.PI / 4 + (north * Math.PI) / 360)) / Math.PI) * WEB_MERCATOR_HALF_WORLD;
  const minY = (Math.log(Math.tan(Math.PI / 4 + (south * Math.PI) / 360)) / Math.PI) * WEB_MERCATOR_HALF_WORLD;
  return [minX, minY, maxX, maxY];
}

export function buildArcGisExportImageUrl(
  serviceUrl: string,
  tile: MapLibreTileCoordinate,
  size = 512,
): string {
  const [xmin, ymin, xmax, ymax] = tileBounds3857(tile);
  const url = new URL(`${serviceUrl.replace(/\/$/, '')}/exportImage`);
  url.searchParams.set('bbox', `${xmin},${ymin},${xmax},${ymax}`);
  url.searchParams.set('bboxSR', '3857');
  url.searchParams.set('imageSR', '3857');
  url.searchParams.set('size', `${size},${size}`);
  url.searchParams.set('format', 'png32');
  url.searchParams.set('f', 'image');
  return url.toString();
}

export interface RuntimeTileSource {
  readonly id: string;
  readonly state: ResolvedTileSource['state'];
  readonly attribution: string;
  readonly serviceUrl: string | null;
}

export function toRuntimeTileSource(source: ResolvedTileSource): RuntimeTileSource {
  return {
    id: source.asset.id,
    state: source.state,
    attribution: `${source.asset.authority} — ${source.asset.dataset}`,
    serviceUrl: source.url,
  };
}
