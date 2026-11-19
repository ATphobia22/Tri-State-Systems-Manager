import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const router = readFileSync(new URL('../src/lib/router.tsx', import.meta.url), 'utf8');

test('unhashed FEMA and river-stage source contracts are never marked validated', () => {
  for (const id of ['tsm-hydro-001', 'tsm-fema-posey-001']) {
    const entry = router.match(new RegExp("\\{ id: '" + id + "'[^\\n]+"));
    assert.ok(entry, `missing source contract ${id}`);
    assert.match(entry[0], /content_hash: 'sha256:pending'/);
    assert.doesNotMatch(entry[0], /validation_status: 'validated'/);
    assert.match(entry[0], /validation_status: 'review_required'/);
  }
});

test('public source and visualization routes remain connected to the router entry point', () => {
  for (const path of ['memorial', 'river-watch', 'atlas', 'map', 'terrain-3d', 'cesium', 'flood-sim', 'cinematic-engineering', 'data-fabric', 'ledger']) {
    assert.ok(router.includes(`path: '${path}'`), `missing public route ${path}`);
  }
  assert.match(router, /createBrowserRouter\(appRoutes, \{ basename: routerBasename \}\)/);
  assert.match(router, /errorElement: <RouteErrorPage \/>/);
});
