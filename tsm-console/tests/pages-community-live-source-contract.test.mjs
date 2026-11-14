/** Static Pages community-source contracts — no live-network claims. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const view = read('src/routes/TriStateAtlasView.tsx');
const map = read('src/components/TriStateDigitalTwinMap.tsx');
const grant = read('src/components/CommunityGrantMatrix.tsx');
const gauge = read('src/components/PagesUSGSGaugeReader.tsx');
const historic = read('src/components/CommunityFloodHistory.tsx');
const stations = JSON.parse(read('public/data/tsm-river-gauge-locations.geojson'));
const surveys = JSON.parse(read('public/data/ehydro-survey-extents.geojson'));
const floods = JSON.parse(read('src/data/community-flood-history.json'));
const workflow = read('../.github/workflows/deploy-pages.yml');
const router = read('src/lib/router.tsx');
const vite = read('vite.config.ts');

test('Pages grant inventory is a byte-identical repository source snapshot', () => {
  assert.equal(read('public/data/community-grant-matrix-2026-10-08.csv'),
    read('../docs/grants/47620-Grant-Master-Matrix-2026-10-08.csv'));
  assert.match(grant, /2026-10-08/);
  assert.match(grant, /current eligibility is unverified/);
  assert.match(view, /<CommunityGrantMatrix\s*\/>/);
});

test('Pages direct USGS reader is user-triggered, on official API and datum-aware', () => {
  assert.ok(gauge.includes("const ENDPOINT = 'https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items';"), 'gauge reader must use the exact official USGS endpoint');
  assert.match(gauge, /parameter_code', '00065'/);
  assert.match(gauge, /onClick=\{\(\) => void getReading\(\)\}/);
  assert.doesNotMatch(gauge, /setInterval\s*\(/);
  assert.match(gauge, /no NAVD88 conversion/);
  assert.match(view, /<PagesUSGSGaugeReader\s*\/>/);
  assert.equal(stations.features.length, 10);
  assert.ok(stations.features.every((item) => item.properties.locationOnly));
});

test('Historic flood events are cited stages, never spatial inundation surfaces', () => {
  assert.ok(floods.events.length >= 3);
  assert.ok(floods.stations.every(({ sourceUrl }) => new URL(sourceUrl).hostname === 'api.water.noaa.gov'));
  assert.equal(floods.verticalReference, 'GAGE_DATUM');
  assert.match(historic, /Each station uses its own gage datum/);
  assert.match(historic, /Flood depth at a parcel requires separate terrain and hydraulic evidence/);
  assert.match(view, /<CommunityFloodHistory\s*\/>/);
});

test('NPS and Indiana DNR layers are official, source-labeled and site-tappable', () => {
  assert.equal(surveys.features.length, 20);
  const registry = read('src/lib/regional-civic-sites.ts');
  assert.ok(registry.includes('https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0'));
  assert.ok(registry.includes('Sites_NaturePreserves/FeatureServer/8'));
  assert.ok(registry.includes('DNRGIS_DnrNPSites_DNR_IN_1/FeatureServer/18'));
  assert.ok(registry.includes('returnGeometry'));
  assert.ok(registry.includes('esriSpatialRelIntersects'));
  assert.ok(registry.includes('httpsLink'));
  assert.ok(vite.includes("'https://mapservices.nps.gov'"));
  assert.ok(vite.includes("'https://gisdata.in.gov'"));
  assert.ok(view.includes('historic: true, dnr: true, preserves: false'));
  assert.ok(view.includes('checked={regionalLayers.historic}'));
  assert.ok(view.includes('checked={regionalLayers.dnr}'));
  assert.ok(map.includes('setSelectedSite(civicSiteInfo(kind, featureProps))'));
  assert.ok(map.includes('This map location is approximate'));
  assert.ok(map.includes('Ohio River Datum; no NAVD88 offset asserted'));
});

test('Berm/road/retention sketches remain client-only WGS84 planning geometry', () => {
  assert.match(view, /type ProposalMode = 'berm' \| 'road' \| 'retention'/);
  assert.match(view, /onProposalPoint=\{addProposalPoint\}/);
  assert.match(view, /HUMAN_PROPOSED_UNVERIFIED/);
  assert.match(view, /application\/geo\+json/);
  assert.match(view, /does not consume your map sketches/);
  assert.match(map, /atlas-proposals/);
});

test('Pages root selects the Atlas without removing the memorial route', () => {
  assert.match(workflow, /VITE_TSM_PAGES_ATLAS_HOME: 'true'/);
  assert.match(router, /VITE_TSM_PAGES_ATLAS_HOME/);
  assert.match(router, /path: 'memorial'/);
  assert.match(router, /path: 'atlas'/);
});

test('Pages publishes a direct Atlas entry on the same base path as the console', () => {
  assert.match(workflow, /cp dist\/index\.html dist\/atlas\/index\.html/);
  assert.match(workflow, /cmp -s dist\/index\.html dist\/atlas\/index\.html/);
  assert.match(workflow, /curl --fail [^\n]+\/atlas\//);
  assert.match(read('../README.md'), /https:\/\/atphobia22\.github\.io\/Tri-State-Systems-Manager\/atlas\//);
});

test('MapLibre CSS must load eagerly to prevent lazy-route stylesheet preload errors on Pages', () => {
  const main = read('src/main.tsx');
  assert.match(main, /import 'maplibre-gl\/dist\/maplibre-gl\.css'/);
  assert.match(workflow, /MapLibre stylesheet missing from eager entry CSS/);
  assert.match(workflow, /Missing built stylesheet/);
});

test('Pages Atlas route CSS is linked eagerly, not deferred to route-time preload', () => {
  const main = read('src/main.tsx');
  assert.match(main, /import '\.\/routes\/TriStateAtlasView\.css'/);
  assert.match(workflow, /TriStateAtlasView stylesheet missing from eager entry CSS/);
});
