import type { Map, StyleSpecification } from 'maplibre-gl';
import type { MapTwinLoaderData } from '../types/loaders';
import { MAP_LAYERS } from './map-layers';

const imagery = MAP_LAYERS.find((layer) => layer.id === 'indiana-imagery');
const terrainTemplate = import.meta.env.VITE_TSM_TERRAIN_RGB_URL_TEMPLATE?.trim() || '';

export const TWIN_ENGINEERING_CONSTANTS = Object.freeze({
  lag_ft: 377.2,
  bfe_ft: 375.0,
  berm_crest_ft: 379.8,
  ffe_ft: 382.5,
  no_rise_tolerance_ft: 0.0,
});

export function buildTwinStyle(): StyleSpecification {
  const imageryUrl = imagery?.url;
  if (!imageryUrl) throw new Error('Indiana current imagery source contract is missing');
  const sources: StyleSpecification['sources'] = {
    'indiana-current-imagery': {
      type: 'raster',
      tiles: [`${imageryUrl}/tile/{z}/{y}/{x}`],
      tileSize: 256,
      attribution: imagery?.attribution || 'Indiana Geographic Information Office',
    },
  };
  const layers: StyleSpecification['layers'] = [
    { id: 'indiana-current-imagery', type: 'raster', source: 'indiana-current-imagery', paint: { 'raster-opacity': 1 } },
  ];
  if (terrainTemplate) {
    sources['tsm-terrain-rgb'] = { type: 'raster-dem', tiles: [terrainTemplate], tileSize: 256, encoding: 'mapbox' };
  }
  return { version: 8, sources, layers };
}

export function applyTwinTerrain(map: Map): boolean {
  if (!terrainTemplate) return false;
  map.setTerrain({ source: 'tsm-terrain-rgb', exaggeration: 1.0 });
  return true;
}

export function addFloodAuthorityLayers(map: Map): void {
  map.addSource('fema-nfhl', { type: 'raster', tiles: ['https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=1024,1024&format=png32&transparent=true&layers=show:28,16,3,1,34,23&f=image'], tileSize: 256 });
  map.addSource('indiana-bafm', { type: 'raster', tiles: ['https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=1024,1024&format=png32&transparent=true&layers=show:104,438&f=image'], tileSize: 256 });
  map.addLayer({ id: 'fema-nfhl-overlay', type: 'raster', source: 'fema-nfhl', paint: { 'raster-opacity': 0.45 }, layout: { visibility: 'none' } });
  map.addLayer({ id: 'indiana-bafm-overlay', type: 'raster', source: 'indiana-bafm', paint: { 'raster-opacity': 0.45 }, layout: { visibility: 'none' } });
}

export function applyLiveStageMetadata(map: Map, data: MapTwinLoaderData): void {
  map.setCenter([(data.boundingEnvelope.minLon + data.boundingEnvelope.maxLon) / 2, (data.boundingEnvelope.minLat + data.boundingEnvelope.maxLat) / 2]);
}
