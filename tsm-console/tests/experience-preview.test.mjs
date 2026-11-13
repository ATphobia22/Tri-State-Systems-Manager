import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Stable static contract checks for the real MapLibre 4D Atlas React route.
// They do NOT replace headed visual, assistive-tech or live network testing.
const view = readFileSync(new URL('../src/routes/TriStateAtlasView.tsx', import.meta.url), 'utf8');
const style = readFileSync(new URL('../src/routes/TriStateAtlasView.css', import.meta.url), 'utf8');
const router = readFileSync(new URL('../src/lib/router.tsx', import.meta.url), 'utf8');
const nav = readFileSync(new URL('../src/components/RootLayout.tsx', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const blueprint = readFileSync(new URL('../../docs/UX-CINEMATIC-4D-ATLAS.md', import.meta.url), 'utf8');
const map = readFileSync(new URL('../src/components/TriStateDigitalTwinMap.tsx', import.meta.url), 'utf8');

test('Atlas is registered and discoverable without replacing the existing console', () => {
  assert.match(router, /path: 'atlas'/);
  assert.match(router, /TriStateAtlasView/);
  assert.match(nav, /to: '\/atlas'/);
  assert.match(view, /from '..\/components\/TriStateDigitalTwinMap'/);
  assert.match(view, /from '..\/components\/RiverGaugeBoard'/);
});

test('three accessible user lenses expose real source and engineering context', () => {
  for (const label of ['Explore', 'Engineer', 'Peer review']) {
    assert.ok(view.includes(label), 'missing ' + label + ' lens');
  }
  assert.match(view, /aria-pressed=\{lens === item.id\}/);
  assert.match(view, /aria-label="Real source layer controls"/);
  assert.match(view, /aria-label="Data and evidence inspector"/);
  assert.match(view, /MAP_PLANE_FABRIC\.map/);
  assert.match(view, /TSM_DATA_FABRICS\.filter/);
  assert.match(view, /selectedSource\.sourceAuthority/);
  assert.match(view, /selectedSource\.notes/);
  assert.match(view, /setLayers\(defaultMapPlaneVisibility\(\)\)/);
});

test('Atlas reports honest source availability and avoids fabricated hydraulic numbers', () => {
  assert.match(view, /source availability unknown/);
  assert.match(view, /Configured source/);
  assert.match(view, /not runtime-verified/);
  assert.match(view, /not proof of a successful source request/);
  assert.match(view, /onMapStatus|mapStatus/);
  assert.match(view, /onStatusChange=\{onMapStatus\}/);
  assert.match(view, /riverOpen \? <RiverGaugeBoard/);
  assert.match(view, /Station observations have not been requested/);
  assert.match(view, /No automatic filing or professional certification/);
  assert.doesNotMatch(view, /Math\.random\(|setInterval\(|runIllustrativeScreeningScenario\(/);
});

test('Atlas supports keyboard-visible and reduced-motion user experience', () => {
  assert.match(style, /focus-visible/);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(style, /@media\(max-width:850px\)/);
  assert.match(style, /min-height:44px/);
  assert.match(view, /aria-live="polite"/);
  assert.match(view, /aria-expanded=\{riverOpen\}/);
  assert.match(view, /aria-controls="tsm-atlas-gauge-board"/);
});

test('README and UX blueprint keep engineering evidence limitations explicit', () => {
  assert.match(readme, /tsm-source-backed-atlas\.svg/);
  assert.match(readme, /not live telemetry/i);
  assert.match(readme, /Human authority remains final/i);
  assert.match(blueprint, /MapLibre/);
  assert.match(blueprint, /WCAG 2\.2 AA/);
  assert.match(map, /setLayoutProperty/);
});
