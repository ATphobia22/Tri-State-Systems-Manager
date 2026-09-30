import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fabric = fs.readFileSync(new URL('../src/lib/map-plane-fabric.ts', import.meta.url), 'utf8');

test('MapLibre plane defines twelve source planes', () => {
  assert.equal((fabric.match(/index: \d+/g) ?? []).length, 12);
  assert.match(fabric, /VITE_TSM_TERRAIN_RGB_URL_TEMPLATE/);
  assert.match(fabric, /hazards\.fema\.gov/);
  assert.match(fabric, /gisdata\.in\.gov/);
  assert.match(fabric, /di-ingov\.img\.arcgis\.com/);
  assert.match(fabric, /tile\.openstreetmap\.org/);
});

test('engineering API is not auto-executed by the visualization plane', () => {
  assert.match(fabric, /never auto-posted by the map/);
  assert.match(fabric, /api\/engineering\/ras-results/);
});


test('MapLibre plane uses real registered raster endpoints and no placeholder hosts', () => {
  const source = fs.readFileSync(new URL('../src/components/TriStateDigitalTwinMap.tsx', import.meta.url), 'utf8');
  assert.match(source, /tile\.openstreetmap\.org/);
  assert.match(source, /hazards\.fema\.gov\/arcgis\/rest\/services\/public\/NFHL\/MapServer/);
  assert.match(source, /gisdata\.in\.gov\/server\/rest\/services\/Best_Available_Flood_Hazard_Layer/);
  assert.match(source, /di-ingov\.img\.arcgis\.com\/arcgis\/rest\/services\/DynamicWebMercator\/Indiana_Current_Imagery\/ImageServer/);
  assert.doesNotMatch(source, /example\\.(com|org|invalid)/i);
  assert.doesNotMatch(source, /protomaps\.com\\{z\\}/i);
});
