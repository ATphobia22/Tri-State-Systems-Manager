import type { GeoJSONSource, LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';

/**
 * On-demand, viewport-bounded reference geometry from Indiana GIO.
 * These are *2D reference features*, never surveyed parcel limits or LoD2+ buildings.
 * No network requests occur until the user explicitly enables a layer.
 */
export type IndianaFeatureKind = 'parcels' | 'roads' | 'buildings';
export type IndianaFeatureStatus =
  | 'DISABLED' | 'ZOOM_REQUIRED' | 'LOADING' | 'EMPTY'
  | 'DISPLAYED_UNVERIFIED' | 'TOO_MANY_FEATURES' | 'SOURCE_UNAVAILABLE';

export interface IndianaFeatureState {
  readonly kind: IndianaFeatureKind;
  readonly status: IndianaFeatureStatus;
  readonly count: number;
  readonly detail: string;
}

export interface GeographicBounds {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

export const INDIANA_FEATURE_CAP = 2000;
export const INDIANA_FEATURE_MIN_ZOOM = 14;

export const INDIANA_FEATURE_LAYERS = {
  parcels: {
    title: 'Indiana 2025 parcel boundaries',
    service: 'https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_2025/FeatureServer/0',
    source: 'tsm-igio-2025-parcels',
    layer: 'tsm-igio-2025-parcels-outline',
    geometry: 'polygon',
    authority: 'CONTEXT',
  },
  roads: {
    title: 'Indiana current road centerlines',
    service: 'https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_Current/FeatureServer/0',
    source: 'tsm-igio-roads',
    layer: 'tsm-igio-roads-line',
    geometry: 'line',
    authority: 'CONTEXT',
  },
  buildings: {
    title: 'Indiana 2016–2020 building footprints',
    service: 'https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0',
    source: 'tsm-igio-buildings',
    layer: 'tsm-igio-buildings-fill',
    geometry: 'polygon',
    authority: 'DERIVED',
  },
} as const;

const KINDS: readonly IndianaFeatureKind[] = ['parcels', 'roads', 'buildings'];
const EMPTY_GEOJSON = { type: 'FeatureCollection' as const, features: [] };
type JsonResponse = { ok: boolean; status: number; json(): Promise<unknown> };
type FetchFeatures = (url: string, init: { signal: AbortSignal }) => Promise<JsonResponse>;

function validBounds(bounds: GeographicBounds): boolean {
  return Object.values(bounds).every(Number.isFinite)
    && bounds.west >= -180 && bounds.east <= 180
    && bounds.south >= -90 && bounds.north <= 90
    && bounds.west < bounds.east && bounds.south < bounds.north
    && bounds.east - bounds.west <= 0.08
    && bounds.north - bounds.south <= 0.08;
}

export function buildIndianaFeatureQuery(
  kind: IndianaFeatureKind, bounds: GeographicBounds, countOnly: boolean,
): string {
  if (!validBounds(bounds)) throw new RangeError('Viewport must be a bounded WGS84 envelope (max 0.08 degrees).');
  const service = INDIANA_FEATURE_LAYERS[kind].service;
  const url = new URL(service + '/query');
  url.searchParams.set('where', '1=1');
  url.searchParams.set('geometryType', 'esriGeometryEnvelope');
  url.searchParams.set('geometry', [bounds.west, bounds.south, bounds.east, bounds.north].join(','));
  url.searchParams.set('inSR', '4326');
  url.searchParams.set('outSR', '4326');
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  url.searchParams.set('f', countOnly ? 'json' : 'geojson');
  url.searchParams.set('returnCountOnly', countOnly ? 'true' : 'false');
  if (!countOnly) {
    url.searchParams.set('returnGeometry', 'true');
    url.searchParams.set('outFields', 'objectid');
    url.searchParams.set('geometryPrecision', '6');
    url.searchParams.set('resultRecordCount', String(INDIANA_FEATURE_CAP));
  }
  return url.toString();
}

function validateCollection(value: unknown, count: number): boolean {
  if (!value || typeof value !== 'object') return false;
  const data = value as { type?: unknown; features?: unknown; exceededTransferLimit?: unknown };
  if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)
    || data.features.length !== count || data.exceededTransferLimit === true) return false;
  return data.features.every((feature: unknown) => {
    if (!feature || typeof feature !== 'object') return false;
    const item = feature as { type?: string; geometry?: { type?: string } | null };
    return item.type === 'Feature' && !!item.geometry &&
      ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString'].includes(item.geometry.type ?? '');
  });
}

export interface IndianaFeatureFabric {
  readonly setEnabled: (kind: IndianaFeatureKind, enabled: boolean) => void;
  readonly dispose: () => void;
  readonly refresh: () => void;
}

/**
 * No synthetic fallback on failure. Each request uses a count preflight so
 * ArcGIS record limits cannot silently masquerade as complete feature coverage.
 * Cancellation protects map teardown and rapid camera moves.
 */
export function attachIndianaFeatureFabric(
  map: MapLibreMap,
  report: (state: IndianaFeatureState) => void,
  fetcher: FetchFeatures = (url, init) => fetch(url, init),
): IndianaFeatureFabric {
  const enabled = new Set<IndianaFeatureKind>();
  const controllers = new Map<IndianaFeatureKind, AbortController>();
  const generations = new Map<IndianaFeatureKind, number>();
  let disposed = false;

  const clearData = (kind: IndianaFeatureKind) => {
    const source = map.getSource(INDIANA_FEATURE_LAYERS[kind].source) as GeoJSONSource | undefined;
    source?.setData(EMPTY_GEOJSON);
  };

  const emit = (kind: IndianaFeatureKind, status: IndianaFeatureStatus, count: number, detail: string) => {
    if (!disposed) report({ kind, status, count, detail });
  };

  const load = async (kind: IndianaFeatureKind): Promise<void> => {
    const previous = controllers.get(kind);
    previous?.abort();
    const version = (generations.get(kind) ?? 0) + 1;
    generations.set(kind, version);
    const controller = new AbortController();
    controllers.set(kind, controller);
    const current = () => !disposed && enabled.has(kind)
      && generations.get(kind) === version && !controller.signal.aborted;

    if (map.getZoom() < INDIANA_FEATURE_MIN_ZOOM) {
      clearData(kind);
      emit(kind, 'ZOOM_REQUIRED', 0, 'Zoom to level 14 or closer to query bounded reference geometry.');
      return;
    }

    const bounds = map.getBounds();
    const box = { west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() };
    if (!validBounds(box)) {
      clearData(kind);
      emit(kind, 'ZOOM_REQUIRED', 0, 'Narrow the viewport; wide-area requests are not permitted.');
      return;
    }

    emit(kind, 'LOADING', 0, 'Querying an official reference source for the visible map extent.');
    try {
      const countRes = await fetcher(buildIndianaFeatureQuery(kind, box, true), { signal: controller.signal });
      if (!countRes.ok) throw new Error('ArcGIS count request returned HTTP ' + countRes.status);
      const countPayload = await countRes.json() as { count?: unknown; error?: unknown };
      if (countPayload.error || typeof countPayload.count !== 'number' || !Number.isSafeInteger(countPayload.count) || (countPayload.count as number) < 0) {
        throw new Error('ArcGIS did not return a valid feature count.');
      }
      const count = countPayload.count as number;
      if (!current()) return;
      if (count > INDIANA_FEATURE_CAP) {
        clearData(kind);
        emit(kind, 'TOO_MANY_FEATURES', count, 'Viewport has more than 2,000 features; zoom further in. No partial features displayed.');
        return;
      }
      if (count === 0) {
        clearData(kind);
        emit(kind, 'EMPTY', 0, 'No reference features intersect the viewport.');
        return;
      }

      const featuresRes = await fetcher(buildIndianaFeatureQuery(kind, box, false), { signal: controller.signal });
      if (!featuresRes.ok) throw new Error('ArcGIS GeoJSON request returned HTTP ' + featuresRes.status);
      const data = await featuresRes.json();
      if (!current()) return;
      if (!validateCollection(data, count)) {
        clearData(kind);
        emit(kind, 'SOURCE_UNAVAILABLE', 0, 'GeoJSON feature count or geometry failed validation. Truncated data withheld.');
        return;
      }
      const source = map.getSource(INDIANA_FEATURE_LAYERS[kind].source) as GeoJSONSource | undefined;
      if (!source) throw new Error('The viewport source is not registered.');
      source.setData(data as Parameters<GeoJSONSource['setData']>[0]);
      emit(kind, 'DISPLAYED_UNVERIFIED', count,
        'Reference features returned from IGIO; not independently byte-verified, surveyed or suitable for engineering determinations.');
    } catch (error) {
      if (!current()) return;
      clearData(kind);
      emit(kind, 'SOURCE_UNAVAILABLE', 0,
        error instanceof Error ? error.message : 'Source request failed.');
    }
  };

  for (const kind of KINDS) {
    const entry = INDIANA_FEATURE_LAYERS[kind];
    if (!map.getSource(entry.source)) map.addSource(entry.source, { type: 'geojson', data: EMPTY_GEOJSON });
    if (!map.getLayer(entry.layer)) {
      const layer: LayerSpecification = kind === 'roads'
        ? { id: entry.layer, type: 'line', source: entry.source,
            paint: { 'line-color': '#fcd34d', 'line-width': 1.7, 'line-opacity': 0.85 },
            layout: { visibility: 'none' } }
        : { id: entry.layer, type: 'line', source: entry.source,
            paint: { 'line-color': kind === 'parcels' ? '#2dd4bf' : '#f472b6',
              'line-width': kind === 'parcels' ? 1.3 : 1.8, 'line-opacity': 0.85 },
            layout: { visibility: 'none' } };
      map.addLayer(layer);
    }
    emit(kind, 'DISABLED', 0, 'On-demand reference layer; no network request until enabled.');
  }

  const refresh = () => {
    for (const kind of enabled) void load(kind);
  };
  map.on('moveend', refresh);

  return {
    setEnabled(kind, shouldEnable) {
      if (disposed) return;
      const layer = INDIANA_FEATURE_LAYERS[kind].layer;
      if (shouldEnable) {
        enabled.add(kind);
        map.setLayoutProperty(layer, 'visibility', 'visible');
        void load(kind);
      } else {
        enabled.delete(kind);
        controllers.get(kind)?.abort();
        generations.set(kind, (generations.get(kind) ?? 0) + 1);
        map.setLayoutProperty(layer, 'visibility', 'none');
        clearData(kind);
        emit(kind, 'DISABLED', 0, 'Disabled; source geometry discarded from memory.');
      }
    },
    refresh,
    dispose() {
      if (disposed) return;
      disposed = true;
      map.off('moveend', refresh);
      for (const controller of controllers.values()) controller.abort();
      for (const kind of KINDS) {
        const entry = INDIANA_FEATURE_LAYERS[kind];
        if (map.getLayer(entry.layer)) map.removeLayer(entry.layer);
        if (map.getSource(entry.source)) map.removeSource(entry.source);
      }
    },
  };
}
