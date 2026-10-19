import { Popup, type GeoJSONSource, type Map as MapLibreMap, type MapLayerMouseEvent } from 'maplibre-gl';

export interface ParcelBbox {
  readonly xmin: number;
  readonly ymin: number;
  readonly xmax: number;
  readonly ymax: number;
}

export interface ParcelFeatureCollection {
  readonly type: 'FeatureCollection';
  readonly features: Array<{
    readonly type: 'Feature';
    readonly id?: string | number;
    readonly geometry: GeoJSON.Geometry;
    readonly properties: {
      readonly parcel_id?: string;
      readonly source_id?: string;
      readonly source_record_id?: string | null;
      readonly source_updated_at?: string | null;
    };
  }>;
  readonly truncated?: boolean;
}

const SOURCE_ID = 'tsm-supabase-public-parcels';
const FILL_LAYER_ID = 'tsm-supabase-public-parcels-fill';
const LINE_LAYER_ID = 'tsm-supabase-public-parcels-line';
const EMPTY_COLLECTION: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function getSupabaseConfig(): { url: string; key: string } | null {
  const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!rawUrl || !key) return null;

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
      return null;
    }
    return { url: url.origin, key };
  } catch {
    return null;
  }
}

export function validateParcelBbox(bbox: ParcelBbox): boolean {
  const values = [bbox.xmin, bbox.ymin, bbox.xmax, bbox.ymax];
  return values.every(Number.isFinite)
    && bbox.xmin >= -180 && bbox.xmax <= 180
    && bbox.ymin >= -85.05112878 && bbox.ymax <= 85.05112878
    && bbox.xmin < bbox.xmax && bbox.ymin < bbox.ymax
    && bbox.xmax - bbox.xmin <= 2 && bbox.ymax - bbox.ymin <= 2;
}

export async function fetchParcelBbox(
  bbox: ParcelBbox,
  signal?: AbortSignal,
): Promise<ParcelFeatureCollection> {
  if (!validateParcelBbox(bbox)) throw new Error('Parcel bounding box is invalid or too broad.');
  const config = getSupabaseConfig();
  if (!config) throw new Error('Supabase parcel API is not configured.');

  const response = await fetch(`${config.url}/rest/v1/rpc/get_parcels_in_bbox`, {
    method: 'POST',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      p_xmin: bbox.xmin,
      p_ymin: bbox.ymin,
      p_xmax: bbox.xmax,
      p_ymax: bbox.ymax,
    }),
    cache: 'no-store',
    signal,
  });
  if (!response.ok) {
    throw new Error(`Supabase parcel API returned HTTP ${response.status}.`);
  }

  const payload: unknown = await response.json();
  if (
    !payload || typeof payload !== 'object'
    || (payload as { type?: unknown }).type !== 'FeatureCollection'
    || !Array.isArray((payload as { features?: unknown }).features)
  ) {
    throw new Error('Supabase parcel API returned an invalid FeatureCollection.');
  }
  return payload as ParcelFeatureCollection;
}

function getVisibleBbox(map: MapLibreMap): ParcelBbox {
  const bounds = map.getBounds();
  return {
    xmin: bounds.getWest(),
    ymin: bounds.getSouth(),
    xmax: bounds.getEast(),
    ymax: bounds.getNorth(),
  };
}

function popupForFeature(
  map: maplibregl.Map,
  event: MapLayerMouseEvent,
): void {
  const feature = event.features?.[0];
  if (!feature) return;
  const properties = feature.properties ?? {};
  const content = document.createElement('div');
  const heading = document.createElement('strong');
  heading.textContent = 'Public parcel record';
  const id = document.createElement('p');
  id.textContent = `Parcel ID: ${String(properties.parcel_id ?? 'not supplied')}`;
  const source = document.createElement('p');
  source.textContent = `Source: ${String(properties.source_id ?? 'not supplied')}`;
  const updated = document.createElement('p');
  updated.textContent = `Source updated: ${String(properties.source_updated_at ?? 'not supplied')}`;
  const note = document.createElement('small');
  note.textContent = 'Parcel boundary is not a survey or a flood-model result.';
  content.append(heading, id, source, updated, note);
  new Popup()
    .setLngLat(event.lngLat)
    .setDOMContent(content)
    .addTo(map);
}

/**
 * Attaches a bounded PostGIS parcel overlay to an existing MapLibre map.
 * Queries occur only after map movement and at zoom >= 13. No timer or polling.
 * The source is disabled unless public Supabase URL + publishable key are set.
 */
export function attachSupabaseParcelBboxLayer(map: maplibregl.Map): () => void {
  if (!getSupabaseConfig()) return () => undefined;
  if (map.getSource(SOURCE_ID)) return () => undefined;

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: EMPTY_COLLECTION,
    promoteId: 'id',
  });
  map.addLayer({
    id: FILL_LAYER_ID,
    type: 'fill',
    source: SOURCE_ID,
    paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.08 },
  });
  map.addLayer({
    id: LINE_LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    paint: { 'line-color': '#38bdf8', 'line-width': 1.25 },
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let requestSequence = 0;

  const clearFeatures = (): void => {
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(EMPTY_COLLECTION);
  };

  const queryVisibleParcels = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const sequence = ++requestSequence;
      controller?.abort();
      controller = undefined;

      if (map.getZoom() < 13) {
        clearFeatures();
        return;
      }
      const bbox = getVisibleBbox(map);
      if (!validateParcelBbox(bbox)) {
        clearFeatures();
        return;
      }

      controller = new AbortController();
      const activeController = controller;
      void fetchParcelBbox(bbox, activeController.signal)
        .then((collection) => {
          if (sequence !== requestSequence || activeController.signal.aborted) return;
          const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
          source?.setData({
            type: 'FeatureCollection',
            features: collection.features,
          });
        })
        .catch((error: unknown) => {
          if (activeController.signal.aborted || sequence !== requestSequence) return;
          clearFeatures();
          console.warn('Public parcel overlay unavailable; map continues without parcel features.', error);
        });
    }, 250);
  };

  const handleClick = (event: maplibregl.MapLayerMouseEvent): void => popupForFeature(map, event);
  map.on('moveend', queryVisibleParcels);
  map.on('click', FILL_LAYER_ID, handleClick);
  map.on('mouseenter', FILL_LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', FILL_LAYER_ID, () => { map.getCanvas().style.cursor = ''; });
  queryVisibleParcels();

  return () => {
    if (timer) clearTimeout(timer);
    controller?.abort();
    map.off('moveend', queryVisibleParcels);
    map.off('click', FILL_LAYER_ID, handleClick);
  };
}
