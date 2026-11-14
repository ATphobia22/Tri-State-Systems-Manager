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


test('regional atlas uses a state-spanning vector style, source-backed geometry and actual camera controls', () => {
  assert.match(atlas, /REGIONAL_VIEWS/);
  assert.match(atlas, /regionalView=\{region\}/);
  assert.match(atlas, /regionalLayers=\{regionalLayers\}/);
  assert.match(atlas, /type="range"/);
  assert.match(atlas, /Visual day\/night cycle/);
  assert.match(atlas, /does not advance USGS observations/);
  assert.match(map, /REGIONAL_MAX_BOUNDS/);
  assert.ok(map.includes("'https://tiles.openfreemap.org/styles/liberty'"), 'regional basemap must use exact OpenFreeMap style URL');
  assert.match(map, /data\/tsm-river-gauge-locations\.geojson/);
  assert.match(map, /data\/ehydro-survey-extents\.geojson/);
  assert.match(map, /atlas-usgs-gauge-points/);
  assert.match(map, /atlas-usace-ehydro-outline/);
  assert.doesNotMatch(map, /data\/leveed-areas-wabash-v1\.geojson/);
  assert.equal(stations.features.length, 10);
  assert.equal(hydro.features.length, 20);
});

test('regional static source geometries are WGS84, not elevations or simulated flood maps', () => {
  for (const feature of stations.features) {
    assert.equal(feature.geometry.type, 'Point');
    const [lon, lat] = feature.geometry.coordinates;
    assert.ok(Number.isFinite(lon) && Math.abs(lon) <= 180);
    assert.ok(Number.isFinite(lat) && Math.abs(lat) <= 90);
    assert.equal(feature.properties.locationOnly, true);
  }
  assert.equal(hydro.properties.verticalDatum, 'Ohio River Datum');
  for (const feature of hydro.features) {
    assert.equal(feature.geometry.type, 'Polygon');
    for (const ring of feature.geometry.coordinates) {
      for (const [lon, lat] of ring) {
        assert.ok(Number.isFinite(lon) && Math.abs(lon) <= 180);
        assert.ok(Number.isFinite(lat) && Math.abs(lat) <= 90);
      }
    }
  }
});


test('Wabash cinematic flight is user-controlled and honors OS reduced motion', () => {
  const tour = read('src/lib/cinematic/camera-tour.ts');
  assert.match(atlas, /Play Wabash flyover/);
  assert.match(atlas, /Stop Wabash flyover/);
  assert.match(atlas, /cinematicTour=\{cinematicTour\}/);
  assert.match(map, /playCinematicTour\(map\)/);
  assert.match(map, /setMapReady\(true\)/);
  assert.match(tour, /prefersReducedMotion\(\)/);
  assert.match(tour, /map\.easeTo\(/);
  assert.match(tour, /map\.stop\(\)/);
  assert.doesNotMatch(tour, /Math\.random/);
});
