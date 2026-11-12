import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachIndianaFeatureFabric, buildIndianaFeatureQuery, INDIANA_FEATURE_CAP, INDIANA_FEATURE_LAYERS,
} from '../src/lib/open-world-feature-fabric.ts';
import { inspectOpenWorldPlanes, OPEN_WORLD_PLANES } from '../src/lib/open-world-layer-inventory.ts';

const box = { west: -87.90, south: 37.92, east: -87.89, north: 37.93 };
const polygon = { type: 'Feature', properties: { objectid: 1 },
  geometry: { type: 'Polygon', coordinates: [[[-87.9,37.92],[-87.89,37.92],[-87.89,37.93],[-87.9,37.92]]] } };
const line = { type: 'Feature', properties: { objectid: 2 },
  geometry: { type: 'LineString', coordinates: [[-87.9,37.92],[-87.89,37.93]] } };
const geojson = { type: 'FeatureCollection', features: [polygon, line] };

function mockMap() {
  const sources = new Map();
  const layers = new Map();
  const events = new Map();
  let zoom = 15;
  return {
    sources, layers, events,
    getZoom: () => zoom,
    setZoom: value => { zoom = value; },
    getBounds: () => ({ getWest: () => box.west, getSouth: () => box.south,
      getEast: () => box.east, getNorth: () => box.north }),
    getSource: id => sources.get(id),
    addSource: (id) => sources.set(id, { data: null, setData(value) { this.data = value; } }),
    removeSource: id => sources.delete(id),
    getLayer: id => layers.get(id),
    addLayer: layer => layers.set(layer.id, layer),
    removeLayer: id => layers.delete(id),
    setLayoutProperty: (id, key, value) => { layers.get(id).layout[key] = value; },
    on: (event, fn) => events.set(event, fn),
    off: (event) => events.delete(event),
  };
}
const nextTick = () => new Promise(resolve => setTimeout(resolve, 25));

test('IGIO endpoints are official FeatureServer/0 and use bounded envelope queries', () => {
  for (const kind of Object.keys(INDIANA_FEATURE_LAYERS)) {
    const query = new URL(buildIndianaFeatureQuery(kind, box, false));
    assert.equal(query.protocol, 'https:');
    assert.equal(query.hostname, 'gisdata.in.gov');
    assert.match(query.pathname, /FeatureServer\/0\/query$/);
    assert.equal(query.searchParams.get('f'), 'geojson');
    assert.equal(query.searchParams.get('outSR'), '4326');
    assert.equal(query.searchParams.get('inSR'), '4326');
    assert.equal(query.searchParams.get('resultRecordCount'), String(INDIANA_FEATURE_CAP));
  }
  assert.throws(() => buildIndianaFeatureQuery('parcels', { ...box, east: -87.0 }, false), RangeError);
  assert.throws(() => buildIndianaFeatureQuery('parcels', { ...box, south: 99 }, false), RangeError);
});

test('reference geometry only queries on explicit enable and clears when disabled', async () => {
  const map = mockMap();
  const calls = [];
  const states = [];
  const fetcher = async (url) => {
    calls.push(new URL(url));
    const count = new URL(url).searchParams.get('returnCountOnly') === 'true';
    return { ok: true, status: 200, json: async () => count ? { count: 2 } : geojson };
  };
  const fabric = attachIndianaFeatureFabric(map, value => states.push(value), fetcher);
  assert.equal(calls.length, 0, 'no eager requests on map creation');
  assert.equal(map.layers.size, 3);
  fabric.setEnabled('roads', true);
  await nextTick();
  assert.equal(calls.length, 2);
  assert.equal(states.at(-1).status, 'DISPLAYED_UNVERIFIED');
  assert.equal(map.sources.get(INDIANA_FEATURE_LAYERS.roads.source).data.features.length, 2);
  fabric.setEnabled('roads', false);
  assert.equal(states.at(-1).status, 'DISABLED');
  assert.equal(map.sources.get(INDIANA_FEATURE_LAYERS.roads.source).data.features.length, 0);
  fabric.dispose();
  assert.equal(map.layers.size, 0);
  assert.equal(map.sources.size, 0);
  assert.equal(map.events.size, 0);
});

test('record-limit preflight prevents silently incomplete citywide overlays', async () => {
  const map = mockMap();
  const states = [];
  let requests = 0;
  const fabric = attachIndianaFeatureFabric(map, value => states.push(value), async () => {
    requests += 1;
    return { ok: true, status: 200, json: async () => ({ count: INDIANA_FEATURE_CAP + 1 }) };
  });
  fabric.setEnabled('parcels', true);
  await nextTick();
  assert.equal(requests, 1);
  assert.equal(states.at(-1).status, 'TOO_MANY_FEATURES');
  assert.equal(map.sources.get(INDIANA_FEATURE_LAYERS.parcels.source).data.features.length, 0);
  fabric.dispose();
});

test('truncated GeoJSON is rejected instead of passing off as complete evidence', async () => {
  const map = mockMap();
  const states = [];
  const fabric = attachIndianaFeatureFabric(map, value => states.push(value), async url => ({
    ok: true, status: 200, json: async () =>
      new URL(url).searchParams.get('returnCountOnly') === 'true'
        ? { count: 2 } : { type: 'FeatureCollection', features: [polygon] },
  }));
  fabric.setEnabled('buildings', true);
  await nextTick();
  assert.equal(states.at(-1).status, 'SOURCE_UNAVAILABLE');
  assert.equal(map.sources.get(INDIANA_FEATURE_LAYERS.buildings.source).data.features.length, 0);
  fabric.dispose();
});

test('zoom floor avoids broad queries and a camera move can retrigger bounded load', async () => {
  const map = mockMap();
  map.setZoom(12);
  let requests = 0;
  const states = [];
  const fabric = attachIndianaFeatureFabric(map, value => states.push(value), async url => {
    requests++;
    return { ok: true, status: 200, json: async () =>
      new URL(url).searchParams.get('returnCountOnly') === 'true'
        ? { count: 0 } : { type: 'FeatureCollection', features: [] } };
  });
  fabric.setEnabled('parcels', true);
  await nextTick();
  assert.equal(requests, 0);
  assert.equal(states.at(-1).status, 'ZOOM_REQUIRED');
  map.setZoom(15);
  map.events.get('moveend')();
  await nextTick();
  assert.equal(requests, 1);
  assert.equal(states.at(-1).status, 'EMPTY');
  fabric.dispose();
});

test('all twelve structural planes are accounted for without merging authority classes', () => {
  assert.equal(OPEN_WORLD_PLANES.length, 12);
  assert.deepEqual(OPEN_WORLD_PLANES.map(x => x.index), Array.from({ length: 12 }, (_, i) => i + 1));
  assert.equal(new Set(OPEN_WORLD_PLANES.map(x => x.id)).size, 12);
  const fema = OPEN_WORLD_PLANES.find(x => x.id === 'fema');
  const bafm = OPEN_WORLD_PLANES.find(x => x.id === 'indiana-bafm');
  assert.equal(fema.authority, 'REGULATORY');
  assert.equal(bafm.authority, 'PLANNING');
  const assessed = inspectOpenWorldPlanes({
    hasMapLayer: id => id === 'fema-nfhl-overlay' || id === 'tsm-hydraulic-extrusion',
    terrainEnabled: false, gaugeMarkerAvailable: true,
    featureStates: { parcels: 'DISPLAYED_UNVERIFIED', buildings: 'SOURCE_UNAVAILABLE' },
    presentationEnabled: true,
  });
  assert.equal(assessed.find(x => x.plane.id === 'parcels').readiness, 'REFERENCE_FEATURES_DISPLAYED');
  assert.equal(assessed.find(x => x.plane.id === 'buildings').readiness, 'SOURCE_UNAVAILABLE');
  assert.equal(assessed.find(x => x.plane.id === 'hec-ras').readiness, 'MODEL_EVIDENCE_REQUIRED');
  assert.equal(assessed.find(x => x.plane.id === 'terrain').readiness, 'SOURCE_UNAVAILABLE');
  assert.equal(assessed.find(x => x.plane.id === 'cinematic').readiness, 'PRESENTATION_ONLY');
});

test('native 3D buildings are opt-in and explicitly derived/subset, not full county', async () => {
  const { readFileSync } = await import('node:fs');
  const component = readFileSync(new URL('../src/components/RealWorldTwinMap.tsx', import.meta.url), 'utf8');
  const tileset = JSON.parse(readFileSync(new URL('../public/3d-tiles/buildings-lidar-12450/tileset.json', import.meta.url), 'utf8'));
  const rootTileset = JSON.parse(readFileSync(new URL('../public/3d-tiles/tileset.json', import.meta.url), 'utf8'));
  assert.match(component, /buildings-lidar-12450\/tileset\.json/);
  assert.match(component, /setBuildingTiles3DVisible/);
  assert.match(component, /3D Buildings \(partial\)/);
  assert.equal(tileset.asset.extras.tsm.authorityClass, 'DERIVED');
  assert.equal(rootTileset.asset.extras.tsm.sourceIdsReconciled, false);
  assert.equal(rootTileset.asset.extras.tsm.regulatoryUse, false);
  assert.equal(rootTileset.asset.extras.tsm.geojsonCountIsNotMeshCount, true);
});

test('plane inspection respects hidden overlays and does not claim JSON-only buildings as verified', () => {
  const runtime = {
    hasMapLayer: id => id === 'fema-nfhl-overlay',
    isMapLayerVisible: () => false,
    terrainEnabled: false,
    gaugeMarkerAvailable: false,
    featureStates: {},
    presentationEnabled: false,
    buildingTiles3DStatus: 'ready',
  };
  const planes = inspectOpenWorldPlanes(runtime);
  const fema = planes.find(x => x.plane.id === 'fema');
  const buildings = planes.find(x => x.plane.id === 'buildings');
  assert.equal(fema.readiness, 'RENDERER_REGISTERED');
  assert.equal(fema.visible, false);
  assert.equal(buildings.readiness, 'DERIVED_TILESET_JSON_LOADED');
  assert.equal(buildings.visible, true);
  assert.equal(planes.find(x => x.plane.id === 'cinematic').visible, false);
});
