/** Source-wiring checks for the public 4D Atlas. Not a headed runtime or network test. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(dir, '..', p), 'utf8');
const atlas = read('src/routes/TriStateAtlasView.tsx');
const router = read('src/lib/router.tsx');
const layout = read('src/components/RootLayout.tsx');
const map = read('src/components/TriStateDigitalTwinMap.tsx');
const gauge = read('src/components/RiverGaugeBoard.tsx');
const stations = JSON.parse(read('public/data/tsm-river-gauge-locations.geojson'));
const hydro = JSON.parse(read('public/data/ehydro-survey-extents.geojson'));
const svg = read('../docs/assets/tsm-source-backed-atlas.svg');

test('Atlas is navigable in the actual React Router and application sidebar', () => {
  assert.match(router, /path: 'atlas'/);
  assert.match(router, /import\('\.\.\/routes\/TriStateAtlasView'\)/);
  assert.match(layout, /to: '\/atlas'/);
});

test('Atlas uses actual repo source-bound MapLibre digital twin and registered fabrics', () => {
  assert.match(atlas, /<TriStateDigitalTwinMap\b/);
  assert.match(atlas, /<RiverGaugeBoard\s*\/>/);
  assert.match(atlas, /TSM_DATA_FABRICS/);
  assert.match(atlas, /MAP_PLANE_FABRIC/);
  assert.match(atlas, /onStatusChange=\{onMapStatus\}/);
  assert.match(map, /onStatusChange\?:/);
});

test('Atlas introduces no synthetic stage, random spatial positions or background polling', () => {
  assert.doesNotMatch(atlas, /fetch\s*\(/);
  assert.doesNotMatch(atlas, /setInterval\s*\(/);
  assert.doesNotMatch(atlas, /Math\.random\s*\(/);
  assert.doesNotMatch(atlas, /runIllustrativeScreeningScenario/);
  assert.match(gauge, /const fetchSnapshot = useCallback\(async \(\) =>/);
});

test('README map illustration is generated from real checked-in sources, not a fake flood surface', () => {
  assert.equal(stations.type, 'FeatureCollection');
  assert.equal(hydro.type, 'FeatureCollection');
  assert.equal(stations.features.length, 10);
  assert.equal(hydro.features.length, 20);
  assert.match(svg, /EPSG:4326/);
  assert.match(svg, /USACE eHydro survey extents/);
  assert.match(svg, /NO LIVE WATER VALUES IN THIS IMAGE/);
});
