import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fabric = fs.readFileSync(new URL('../src/lib/map-plane-fabric.ts', import.meta.url), 'utf8');

test('MapLibre plane defines twelve source planes', async () => {
  // The layer index is assigned programmatically in asMapPlaneLayer, so
  // count the registered layers rather than grepping for index literals.
  // (map-plane-fabric.ts itself is not imported: its extensionless relative
  // import is unresolvable under plain node ESM. MAP_PLANE_FABRIC is a 1:1
  // map of MAPLIBRE_FABRIC_LAYERS, so the registry length is equivalent.)
  const { MAPLIBRE_FABRIC_LAYERS } = await import('../src/lib/maplibre-layer-fabric.ts');
  assert.equal(MAPLIBRE_FABRIC_LAYERS.length, 12);
  const contract = fs.readFileSync(new URL('../src/lib/terrain-rgb-contract.ts', import.meta.url), 'utf8');
  assert.match(contract, /VITE_TSM_TERRAIN_RGB_URL_TEMPLATE/);
  const registry = fs.readFileSync(new URL('../src/lib/maplibre-layer-fabric.ts', import.meta.url), 'utf8');
  assert.match(registry, /hazards\.fema\.gov/);
  assert.match(registry, /gisdata\.in\.gov/);
  assert.match(registry, /di-ingov\.img\.arcgis\.com/);
  assert.match(MAPLIBRE_FABRIC_LAYERS.map((l) => l.endpoint).join('\n'), /tile\.openstreetmap\.org/);
});

test('engineering API is not auto-executed by the visualization plane', () => {
  // The visualization plane must never trigger engineering computation.
  // It references no engineering API route and performs no network POSTs;
  // absence of any such reference is the guarantee (not a comment string).
  assert.doesNotMatch(fabric, /api\/engineering/);
  assert.doesNotMatch(fabric, /ras-results/);
  assert.doesNotMatch(fabric, /fetch\s*\(/);
  assert.doesNotMatch(fabric, /XMLHttpRequest/);
});


test('MapLibre plane uses real registered raster endpoints and no placeholder hosts', async () => {
  // Endpoints live in the fabric registry (maplibre-layer-fabric.ts); the
  // component resolves them via getMapLibreFabricLayer, so assert on the
  // registered values rather than on component source literals.
  const { MAPLIBRE_FABRIC_LAYERS } = await import('../src/lib/maplibre-layer-fabric.ts');
  const endpoints = MAPLIBRE_FABRIC_LAYERS.map((l) => l.endpoint).join('\n');
  assert.match(endpoints, /tile\.openstreetmap\.org/);
  assert.match(endpoints, /hazards\.fema\.gov\/arcgis\/rest\/services\/public\/NFHL\/MapServer/);
  assert.match(endpoints, /gisdata\.in\.gov\/server\/rest\/services\/Best_Available_Flood_Hazard_Layer/);
  assert.match(endpoints, /di-ingov\.img\.arcgis\.com\/arcgis\/rest\/services\/DynamicWebMercator\/Indiana_Current_Imagery\/ImageServer/);
  assert.doesNotMatch(endpoints, /example\.(com|org|invalid)/i);
  const source = fs.readFileSync(new URL('../src/components/TriStateDigitalTwinMap.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /example\\.(com|org|invalid)/i);
  assert.doesNotMatch(source, /protomaps\\.com\\{z\\}/i);
  assert.match(source, /buildArcGisExportTemplate\(imagery, \[\], \{ format: 'jpg', transparent: false, compressionQuality: 90 \}\)/);
  assert.match(source, /buildArcGisExportTemplate\(service, layers\)/);
  assert.match(source, /if \(enabled && !previouslyVisible\[item\.id\]\) void refreshFeatureLayer\(map, item\);/);
  assert.match(source, /else if \(!enabled && previouslyVisible\[item\.id\]\) featureRequestsRef\.current\.cancel\(item\.id\);/);
});
