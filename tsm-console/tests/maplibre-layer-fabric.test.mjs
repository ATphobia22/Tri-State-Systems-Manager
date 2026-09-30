import test from 'node:test';
import assert from 'node:assert/strict';

const { MAPLIBRE_FABRIC_LAYERS, getMapLibreFabricLayer, buildArcGisExportTemplate, buildArcGisFeatureQueryUrl } =
  await import('../src/lib/maplibre-layer-fabric.ts');

test('defines exactly twelve unique MapLibre fabric layers with real HTTPS endpoints', () => {
  assert.equal(MAPLIBRE_FABRIC_LAYERS.length, 12);
  assert.equal(new Set(MAPLIBRE_FABRIC_LAYERS.map((layer) => layer.id)).size, 12);

  for (const layer of MAPLIBRE_FABRIC_LAYERS) {
    assert.match(layer.endpoint, /^https:\/\//);
    assert.doesNotMatch(layer.endpoint, /example\.(com|org|net)|YOUR[-_]?HOST|placeholder/i);
  }
});

test('keeps FEMA effective and Indiana BAFM as separate authority layers', () => {
  const fema = getMapLibreFabricLayer('fema-effective');
  const bafm = getMapLibreFabricLayer('indiana-bafm');

  assert.equal(fema.authorityClass, 'REGULATORY');
  assert.equal(bafm.authorityClass, 'PLANNING');
  assert.notEqual(fema.id, bafm.id);
  assert.notEqual(fema.endpoint, bafm.endpoint);
});

test('builds an ArcGIS export template from a real MapServer endpoint', () => {
  const url = buildArcGisExportTemplate(
    'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
    [28, 16, 3],
  );
  assert.match(url, /\/export\?/);
  assert.match(url, /layers=show:28,16,3/);
  assert.match(url, /bbox=\{bbox-epsg-3857\}/);
});

test('self-hosted terrain layer is bound to the runtime Terrain-RGB template', () => {
  const terrain = getMapLibreFabricLayer('terrain-rgb');
  assert.equal(terrain.kind, 'terrain');
  assert.match(terrain.endpoint, /^https:\\/\\/atphobia22\\.github\\.io\\/Tri-State-Systems-Manager\\/terrain_3dep\\/\\{z\\}\\/\\{x\\}\\/\\{y\\}\\.png$/);
});


test('bounds FeatureServer queries to layer zero and a bounded record count', () => {
  const url = buildArcGisFeatureQueryUrl('https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer');
  assert.match(url, /FeatureServer\\/0\\/query/);
  assert.match(url, /resultRecordCount=500/);
  assert.match(url, /geometry=\\{bbox-epsg-4326\\}/);
});
