/**
 * FEMA NFHL MapServer export helpers — REGULATORY_DISPLAY only.
 * Uses canonical priority stack from NfhlLayerRegistry.
 */
import {
  NFHL_MAPSERVER_URL,
  NFHL_PRIORITY_IDS,
  nfhlPriorityShowParam,
} from './NfhlLayerRegistry';

export interface NfhlExportOptions {
  /** WGS84 bbox: west,south,east,north */
  bbox: [number, number, number, number];
  width?: number;
  height?: number;
  /** Override show: layer list; default priority operational */
  layerIds?: readonly number[];
  format?: 'png' | 'png32' | 'jpg';
  transparent?: boolean;
}

/** Image export URL for MapLibre raster source / Leaflet overlay */
export function buildNfhlExportImageUrl(opts: NfhlExportOptions): string {
  const {
    bbox,
    width = 1024,
    height = 1024,
    layerIds = NFHL_PRIORITY_IDS,
    format = 'png32',
    transparent = true,
  } = opts;
  const [w, s, e, n] = bbox;
  const layers = `show:${layerIds.join(',')}`;
  const params = new URLSearchParams({
    f: 'image',
    format,
    transparent: String(transparent),
    bbox: `${w},${s},${e},${n}`,
    bboxSR: '4326',
    imageSR: '3857',
    size: `${width},${height}`,
    layers,
  });
  return `${NFHL_MAPSERVER_URL}/export?${params.toString()}`;
}

/** Posey County approximate AOI for twin canvas default */
export const POSEY_BBOX_WGS84: [number, number, number, number] = [
  -88.15, 37.75, -87.75, 38.15,
];

export function poseyNfhlPriorityExportUrl(
  width = 1024,
  height = 1024,
): string {
  return buildNfhlExportImageUrl({
    bbox: POSEY_BBOX_WGS84,
    width,
    height,
    layerIds: NFHL_PRIORITY_IDS,
  });
}

export { nfhlPriorityShowParam, NFHL_PRIORITY_IDS, NFHL_MAPSERVER_URL };
