import type { Map, StyleSpecification } from 'maplibre-gl';
import type { MapTwinLoaderData } from '../types/loaders';
import { MAP_LAYERS } from './map-layers';
import { createHydraulicExtrusionLayer, createHydraulicSource } from './hydraulic-rendering';
import {
  resolveTerrainRgbFromEnv,
  TERRAIN_RGB_DEFAULT_EXAGGERATION,
  TERRAIN_RGB_ENCODING,
  TERRAIN_RGB_SOURCE_ID,
  TERRAIN_RGB_TILE_SIZE,
  type TerrainRgbStatus,
} from './terrain-rgb-contract';

const imagery = MAP_LAYERS.find((layer) => layer.id === 'indiana-imagery');

/** Fail-closed Terrain-RGB status (no synthetic mesh when blocked). */
export function getTerrainRgbStatus(): TerrainRgbStatus {
  return resolveTerrainRgbFromEnv(import.meta.env.VITE_TSM_TERRAIN_RGB_URL_TEMPLATE);
}

const ARCGIS_EXPORT_QUERY = 'bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=512,512&format=png32&transparent=false&f=image';

export function buildTwinStyle(): StyleSpecification {
  const imageryUrl = imagery?.url;
  if (!imageryUrl) throw new Error('Indiana current imagery source contract is missing');
  const terrain = getTerrainRgbStatus();
  const sources: StyleSpecification['sources'] = {
    'indiana-current-imagery': {
      type: 'raster',
      tiles: [`${imageryUrl}/export?${ARCGIS_EXPORT_QUERY}`],
      tileSize: 512,
      attribution: imagery?.attribution || 'Indiana Geographic Information Office (CC0)',
    },
  };
  const layers: StyleSpecification['layers'] = [
    { id: 'indiana-current-imagery', type: 'raster', source: 'indiana-current-imagery', paint: { 'raster-opacity': 1 } },
  ];
  // Only register raster-dem when a validated, non-placeholder template exists.
  if (terrain.enabled) {
    sources[TERRAIN_RGB_SOURCE_ID] = {
      type: 'raster-dem',
      tiles: [terrain.template],
      tileSize: TERRAIN_RGB_TILE_SIZE,
      encoding: TERRAIN_RGB_ENCODING,
    };
  }
  return {
    version: 8,
    sources,
    layers,
    light: {
      anchor: 'viewport',
      color: '#fff7e6',
      intensity: 0.65,
      position: [1.15, 215, 35],
    },
    sky: {
      'sky-color': '#6b7da8',
      'sky-horizon-blend': 0.55,
      'horizon-color': '#dbeafe',
      'horizon-fog-blend': 0.65,
      'fog-color': '#cbd5e1',
      'fog-ground-blend': 0.35,
      'atmosphere-blend': 0.7,
    },
  };
}

/**
 * Enable MapLibre 3D terrain only when Terrain-RGB is provenance-configured.
 * Returns false (fail-closed) when VITE_TSM_TERRAIN_RGB_URL_TEMPLATE is missing
 * or invalid — never invents elevation mesh.
 */
export function applyTwinTerrain(map: Map): boolean {
  const terrain = getTerrainRgbStatus();
  if (!terrain.enabled) {
    // Explicit fail-closed teardown if a prior session left terrain enabled.
    try {
      if (typeof map.getTerrain === 'function' && map.getTerrain()) {
        map.setTerrain(null);
      }
      if (map.getSource(TERRAIN_RGB_SOURCE_ID)) {
        map.removeSource(TERRAIN_RGB_SOURCE_ID);
      }
    } catch {
      // Style may not support remove yet; ignore.
    }
    return false;
  }
  if (!map.getSource(TERRAIN_RGB_SOURCE_ID)) return false;
  map.setTerrain({
    source: TERRAIN_RGB_SOURCE_ID,
    exaggeration: TERRAIN_RGB_DEFAULT_EXAGGERATION,
  });
  return true;
}

export function addFloodAuthorityLayers(map: Map): void {
  map.addSource('fema-nfhl', { type: 'raster', tiles: ['https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=512,512&format=png32&transparent=true&layers=show:28,16,3,1,34,23&f=image'], tileSize: 512 });
  map.addSource('indiana-bafm', { type: 'raster', tiles: ['https://gisdata.in.gov/server/rest/services/Best_Available_Flood_Hazard_Layer/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=512,512&format=png32&transparent=true&layers=show:104,438&f=image'], tileSize: 512 });
  map.addLayer({ id: 'fema-nfhl-overlay', type: 'raster', source: 'fema-nfhl', paint: { 'raster-opacity': 0.45 }, layout: { visibility: 'none' } });
  map.addLayer({ id: 'indiana-bafm-overlay', type: 'raster', source: 'indiana-bafm', paint: { 'raster-opacity': 0.45 }, layout: { visibility: 'none' } });
}

export function applyLiveStageMetadata(map: Map, data: MapTwinLoaderData): void {
  map.setCenter([(data.boundingEnvelope.minLon + data.boundingEnvelope.maxLon) / 2, (data.boundingEnvelope.minLat + data.boundingEnvelope.maxLat) / 2]);
}


export function addMartinHydraulicLayer(
  map: Map,
  currentWseNavd88Ft: number | null,
): boolean {
  const martinBaseUrl = import.meta.env.VITE_TSM_MARTIN_BASE_URL?.trim() || '';
  const martinRoutePrefix = import.meta.env.VITE_TSM_MARTIN_ROUTE_PREFIX?.trim() || '';
  if (!martinBaseUrl || currentWseNavd88Ft == null || !Number.isFinite(currentWseNavd88Ft)) {
    return false;
  }

  const sourceId = 'tsm-parcels';
  const layerId = 'tsm-hydraulic-extrusion';

  if (!map.getSource(sourceId)) {
    const source = createHydraulicSource('get_parcel_tiles', martinBaseUrl, martinRoutePrefix);
    map.addSource(sourceId, {
      type: source.type,
      tiles: source.tiles,
      minzoom: source.minzoom,
      maxzoom: source.maxzoom,
    });
  }

  if (!map.getLayer(layerId)) {
    map.addLayer(createHydraulicExtrusionLayer(
      layerId,
      sourceId,
      'parcels',
      currentWseNavd88Ft,
    ));
  } else {
    map.setPaintProperty(
      layerId,
      'fill-extrusion-height',
      [
        '+',
        ['*', ['get', 'ground_elevation_navd88_ft'], 0.3048],
        [
          'max',
          0,
          [
            '-',
            currentWseNavd88Ft * 0.3048,
            ['*', ['get', 'ground_elevation_navd88_ft'], 0.3048],
          ],
        ],
      ],
    );
  }

  return true;
}
