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
const floods = JSON.parse(read('public/data/community-flood-history.json'));
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
  assert.match(gauge, /https:\/\/api\.waterdata\.usgs\.gov\/ogcapi\/v1\/collections\/latest-continuous\/items/);
  assert.match(gauge, /parameter_code', '00065'/);
  assert.match(gauge, /onClick=\{\(\) => void getReading\(\)\}/);
  assert.doesNotMatch(gauge, /setInterval\s*\(/);
  assert.match(gauge, /no NAVD88 conversion/);
  assert.match(view, /<PagesUSGSGaugeReader\s*\/>/);
  assert.equal(stations.features.length, 10);
  assert.ok(stations.features.every((item) => item.properties.locationOnly));
});

test('Historic flood events are cited stages, never spatial inundation surfaces', () => {
  assert.ok(floods.records.length >= 3);
  assert.ok(floods.records.every((item) => item.sourceUrl.startsWith('https://')));
  assert.ok(floods.records.every((item) => /UNVERIFIED/.test(item.gageDatum)));
  assert.match(floods.spatialLimitations, /no flood extent polygons/i);
  assert.match(historic, /NOT NAVD88/);
  assert.match(view, /<CommunityFloodHistory\s*\/>/);
});

test('NPS layer and USACE survey footprints are source labeled, opt-in and non-regulatory', () => {
  assert.equal(surveys.features.length, 20);
  assert.match(map, /https:\/\/mapservices\.nps\.gov\/arcgis\/rest\/services\/cultural_resources\/nrhp_locations\/MapServer\/0\/query/);
  assert.match(vite, /https:\/\/mapservices\.nps\.gov/);
  assert.match(view, /historic: false/);
  assert.match(view, /checked=\{regionalLayers\.historic\}/);
  assert.match(map, /not survey-grade coordinates/);
  assert.match(map, /Ohio River Datum; no NAVD88 offset asserted/);
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
