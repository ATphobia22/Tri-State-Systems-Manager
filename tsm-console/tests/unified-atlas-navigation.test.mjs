import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');

test('public navigation offers short primary destinations and keeps all legacy routes accessible', () => {
  const shell = read('components/RootLayout.tsx');
  assert.match(shell, /const primaryRoutes = new Set\(/);
  assert.match(shell, /className="tsm-more-tools"/);
  assert.match(shell, /!primaryRoutes\.has\(item\.to\)/);
  assert.match(shell, /aria-label="Primary navigation"/);
  assert.match(shell, /inert=\{!navOpen\}/);
  assert.match(shell, /onClick=\{closeMenu\}/);
  for (const route of ['/atlas', '/river-watch', '/flood-sim', '/ledger', '/memorial']) {
    assert.match(shell, new RegExp("'"+route+"'"));
  }
});

test('atlas mounts one actual 2D or 3D engine, not an image or a second duplicate map', () => {
  const atlas = read('routes/TriStateAtlasView.tsx');
  assert.match(atlas, /import CesiumRegionalTwinView from '\.\/CesiumRegionalTwinView'/);
  assert.match(atlas, /data-testid="atlas-renderer-maplibre"/);
  assert.match(atlas, /data-testid="atlas-renderer-cesium"/);
  assert.match(atlas, /renderer === 'cesium'\s*\? <CesiumRegionalTwinView autoFlyover=\{cinematicTour\}/);
  assert.match(atlas, /: <TriStateDigitalTwinMap hideSidebar visible=\{visibleForRegion\}/);
  assert.match(atlas, /disabled=\{Boolean\(drawMode \|\| waypoints\.length\)\}/);
  assert.match(atlas, /Cesium 3D uses its own geographic layer controls/);
  assert.match(atlas, /Map appearance never certifies data coverage/);
});
