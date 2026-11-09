import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';

export type CitySceneStatus = 'LOADING' | 'READY_REFERENCE' | 'MISSING' | 'INTEGRITY_FAILED' | 'INVALID';
export type CitySelection = {
  id: string; kind: 'building' | 'road'; objectid: number; name: string | null;
  source: string; sourceFeatureSha256: string; sourceSceneSha256: string;
  heightM: number | null; evidenceStatus: string; engineeringApproved: false;
};
export const MOUNT_VERNON_CITY_EVENT = 'tsm:mount-vernon-city';
export type CityEvent = { status: CitySceneStatus; reason: string; counts?: { buildings: number; roads: number }; selection?: CitySelection | null };

type SceneShape = {
  schema: string; crs: string; sources: Record<string, unknown>;
  buildings: GeoJSON.FeatureCollection; roads: GeoJSON.FeatureCollection;
};
type SceneReceipt = { schema: string; sha256: string; byte_length: number; review: string; regulatory_approval: boolean };
const SRC_BUILDINGS = 'tsm-mount-vernon-official-building-footprints';
const SRC_ROADS = 'tsm-mount-vernon-official-road-centrelines';
const LAYER_BUILDINGS = 'tsm-mount-vernon-building-footprints';
const LAYER_ROADS = 'tsm-mount-vernon-road-centrelines';
const MAX_SCENE_BYTES = 42_000_000;
const HEX_SHA = /^[a-f0-9]{64}$/;
const OFFICIAL_LAYERS = {
  building: 'https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0',
  road: 'https://gisdata.in.gov/server/rest/services/Hosted/Road_Centerlines_of_Indiana_2024/FeatureServer/0',
} as const;

function allCoordinatesValid(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  if (typeof value[0] === 'number') {
    return value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]) &&
      value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90;
  }
  return value.every(allCoordinatesValid);
}


function emit(detail: CityEvent): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<CityEvent>(MOUNT_VERNON_CITY_EVENT, { detail }));
}
function assertCollection(collection: unknown, kind: 'building' | 'road'): asserts collection is GeoJSON.FeatureCollection {
  if (!collection || typeof collection !== 'object') throw new Error('COLLECTION_MISSING');
  const fc = collection as GeoJSON.FeatureCollection;
  if (fc.type !== 'FeatureCollection' || !Array.isArray(fc.features) || fc.features.length > 100_000) throw new Error('INVALID_COLLECTION');
  const ids = new Set<string>();
  for (const feature of fc.features) {
    const p = feature?.properties;
    const oid = p?.source_objectid;
    const expected = `IGIO:${kind}:${oid}`;
    if (feature?.type !== 'Feature' || !feature.geometry ||
        !((kind === 'building' ? ['Polygon', 'MultiPolygon'] : ['LineString', 'MultiLineString']).includes(feature.geometry.type)) ||
        !Number.isSafeInteger(oid) || oid < 0 || p?.tsm_id !== expected || feature.id !== expected ||
        ids.has(expected) || !HEX_SHA.test(p?.source_feature_sha256 ?? '') ||
        p?.source_url !== OFFICIAL_LAYERS[kind] || p?.kind !== kind ||
        p?.evidence_status !== 'SOURCE_OBSERVED_UNREVIEWED' ||
        !allCoordinatesValid((feature.geometry as GeoJSON.Geometry & { coordinates?: unknown }).coordinates) ||
        p?.engineering_approved !== false || p?.height_m !== null) throw new Error('INVALID_SOURCE_FEATURE_IDENTITY');
    ids.add(expected);
  }
}
export function validateMountVernonScene(input: unknown): asserts input is SceneShape {
  if (!input || typeof input !== 'object') throw new Error('SCENE_MISSING');
  const scene = input as SceneShape;
  if (scene.schema !== 'tsm.mount-vernon-city-scene.v1' || scene.crs !== 'EPSG:4326') throw new Error('SCENE_CRS_OR_SCHEMA_INVALID');
  const sources = scene.sources as Record<string, { layer_url?: string; source_object_count?: number }> | null;
  if (!sources || sources.buildings?.layer_url !== OFFICIAL_LAYERS.building ||
      sources.roads?.layer_url !== OFFICIAL_LAYERS.road) throw new Error('SCENE_OFFICIAL_SOURCE_INVALID');
  assertCollection(scene.buildings, 'building');
  assertCollection(scene.roads, 'road');
  if (sources.buildings.source_object_count !== scene.buildings.features.length ||
      sources.roads.source_object_count !== scene.roads.features.length) throw new Error('SCENE_SOURCE_COUNT_MISMATCH');
}
export async function verifySceneBytes(bytes: Uint8Array, receipt: SceneReceipt): Promise<boolean> {
  if (!receipt || receipt.schema !== 'tsm.mount-vernon-city-receipt.v1' || receipt.review !== 'NOT_EVIDENCED' ||
      receipt.regulatory_approval !== false || !HEX_SHA.test(receipt.sha256) ||
      !Number.isSafeInteger(receipt.byte_length) || receipt.byte_length !== bytes.byteLength ||
      bytes.byteLength === 0 || bytes.byteLength > MAX_SCENE_BYTES || !globalThis.crypto?.subtle) return false;
  const copy = new Uint8Array(bytes);
  const hash = await crypto.subtle.digest('SHA-256', copy.buffer);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('') === receipt.sha256;
}
async function fetchBounded(url: string, signal?: AbortSignal): Promise<Uint8Array> {
  const response = await fetch(url, { cache: 'no-store', credentials: 'omit', redirect: 'error', signal });
  if (!response.ok) throw new Error(response.status === 404 ? 'SCENE_FILE_MISSING' : 'SCENE_FETCH_FAILED');
  const declared = Number(response.headers.get('content-length'));
  if (declared > MAX_SCENE_BYTES) throw new Error('SCENE_EXCEEDS_BYTE_LIMIT');
  if (!response.body) throw new Error('SCENE_RESPONSE_NOT_STREAMABLE');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_SCENE_BYTES) throw new Error('SCENE_EXCEEDS_BYTE_LIMIT');
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
export async function attachMountVernonCityScene(map: MapLibreMap, baseUrl: string, signal?: AbortSignal): Promise<() => void> {
  let removed = false;
  const release = () => {
    removed = true;
    for (const id of [LAYER_ROADS, 'tsm-mount-vernon-footprint-outline', LAYER_BUILDINGS]) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of [SRC_ROADS, SRC_BUILDINGS]) if (map.getSource(id)) map.removeSource(id);
  };
  emit({ status: 'LOADING', reason: 'Checking staged governmental city-scene archive.' });
  try {
    const prefix = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    // Fixed, build-owned relative location: do not accept arbitrary user URLs.
    const receiptBytes = await fetchBounded(prefix + 'scene.receipt.json', signal);
    const receipt = JSON.parse(new TextDecoder().decode(receiptBytes)) as SceneReceipt;
    const sceneBytes = await fetchBounded(prefix + 'scene.json', signal);
    if (!(await verifySceneBytes(sceneBytes, receipt))) throw new Error('SCENE_SHA256_MISMATCH');
    const scene: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(sceneBytes));
    validateMountVernonScene(scene);
    if (removed || signal?.aborted) return release;
    const data = scene as SceneShape;
    if (!map.getSource(SRC_BUILDINGS)) map.addSource(SRC_BUILDINGS, { type: 'geojson', data: data.buildings });
    if (!map.getSource(SRC_ROADS)) map.addSource(SRC_ROADS, { type: 'geojson', data: data.roads });
    // Unknown building heights are deliberately not extruded.
    if (!map.getLayer(LAYER_BUILDINGS)) map.addLayer({
      id: LAYER_BUILDINGS, type: 'fill', source: SRC_BUILDINGS,
      paint: {
        'fill-color': '#4A5568',
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.65, 0.40],
        'fill-antialias': true,
      },
    });
    const outlineId = 'tsm-mount-vernon-footprint-outline';
    if (!map.getLayer(outlineId)) map.addLayer({
      id: outlineId, type: 'line', source: SRC_BUILDINGS,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#CBD5E1',
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 18, 2],
        'line-opacity': 0.8,
      },
    });
    if (!map.getLayer(LAYER_ROADS)) map.addLayer({
      id: LAYER_ROADS, type: 'line', source: SRC_ROADS,
      paint: { 'line-color': '#fbbf24', 'line-width': 1.9, 'line-opacity': 0.88 },
    });
    let hoveredId: string | number | null = null;
    const clearHover = () => {
      if (hoveredId !== null) {
        map.setFeatureState({ source: SRC_BUILDINGS, id: hoveredId }, { hover: false });
        hoveredId = null;
      }
      map.getCanvas().style.cursor = '';
    };
    const onHover = (ev: MapMouseEvent) => {
      const current = map.queryRenderedFeatures(ev.point, { layers: [LAYER_BUILDINGS] })[0]?.id;
      if (current === undefined || current === null) return;
      if (hoveredId !== current) {
        if (hoveredId !== null) map.setFeatureState({ source: SRC_BUILDINGS, id: hoveredId }, { hover: false });
        hoveredId = current;
        map.setFeatureState({ source: SRC_BUILDINGS, id: current }, { hover: true });
      }
      map.getCanvas().style.cursor = 'pointer';
    };
    map.on('mousemove', LAYER_BUILDINGS, onHover);
    map.on('mouseleave', LAYER_BUILDINGS, clearHover);
    const onClick = (ev: MapMouseEvent) => {
      const candidates = map.queryRenderedFeatures(ev.point, { layers: [LAYER_BUILDINGS, LAYER_ROADS] });
      const f = candidates[0]; if (!f) return;
      const p = f.properties ?? {};
      const kind = p.kind === 'building' ? 'building' : 'road';
      const selection: CitySelection = {
        id: String(p.tsm_id), kind, objectid: Number(p.source_objectid),
        name: typeof p.name === 'string' ? p.name : null, source: String(p.source_url),
        sourceFeatureSha256: String(p.source_feature_sha256), sourceSceneSha256: receipt.sha256,
        heightM: null, evidenceStatus: String(p.evidence_status), engineeringApproved: false,
      };
      emit({ status: 'READY_REFERENCE', reason: 'Selected government source geometry; not surveyed.', selection });
    };
    map.on('click', onClick);
    emit({ status: 'READY_REFERENCE', reason: 'Integrity checked; source geometry not independently surveyed or approved.',
      counts: { buildings: data.buildings.features.length, roads: data.roads.features.length } });
    return () => {
      map.off('click', onClick);
      map.off('mousemove', LAYER_BUILDINGS, onHover);
      map.off('mouseleave', LAYER_BUILDINGS, clearHover);
      clearHover();
      release();
    };
  } catch (err) {
    if (removed || signal?.aborted) return release;
    const reason = err instanceof Error ? err.message : 'SCENE_UNAVAILABLE';
    emit({ status: reason === 'SCENE_FILE_MISSING' ? 'MISSING' :
      reason === 'SCENE_SHA256_MISMATCH' ? 'INTEGRITY_FAILED' : 'INVALID', reason });
    return release;
  }
}
