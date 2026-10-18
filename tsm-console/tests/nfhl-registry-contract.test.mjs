import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('NFHL geometry registry has expected layer counts', () => {
  const reg = JSON.parse(
    readFileSync(join(root, 'docs/fabrics/nfhl-geometry-types.json'), 'utf8'),
  );
  const layers = reg.layers ?? [];
  assert.equal(layers.length, 32);
  const counts = { Polygon: 0, Polyline: 0, Point: 0 };
  for (const L of layers) {
    counts[L.geometryType] = (counts[L.geometryType] ?? 0) + 1;
  }
  assert.equal(counts.Polygon, 12);
  assert.equal(counts.Polyline, 12);
  assert.equal(counts.Point, 8);
  assert.deepEqual(reg.expectedCounts, {
    total: 32,
    polygon: 12,
    polyline: 12,
    point: 8,
  });
});

test('NFHL priority operational stack is complete', () => {
  const reg = JSON.parse(
    readFileSync(join(root, 'docs/fabrics/nfhl-geometry-types.json'), 'utf8'),
  );
  const priority = reg.priorityOperational ?? [];
  assert.deepEqual(priority, [28, 27, 16, 23, 34, 3, 22, 32]);
  const ids = new Set((reg.layers ?? []).map((l) => l.id));
  for (const id of priority) {
    assert.ok(ids.has(id), `priority layer ${id} missing from registry`);
  }
});

test('NfhlLayerRegistry.ts exports priority and capability constants', () => {
  const src = readFileSync(
    join(root, 'tsm-console/src/lib/nfhl/NfhlLayerRegistry.ts'),
    'utf8',
  );
  assert.match(src, /NFHL_PRIORITY_IDS/);
  assert.match(src, /geo\.nfhl\.zones/);
  assert.match(src, /Flood Hazard Zones/);
  assert.match(src, /REGULATORY_DISPLAY/);
});

test('maplibre-three-plugin peer is compatible with pinned three', () => {
  const pkg = JSON.parse(
    readFileSync(join(root, 'tsm-console/package.json'), 'utf8'),
  );
  const three = pkg.dependencies.three;
  // Must satisfy @dvt3d/maplibre-three-plugin peer three@^0.178.0
  assert.match(String(three), /0\.178/);
  assert.ok(
    pkg.dependencies['@dvt3d/maplibre-three-plugin'],
    'maplibre-three-plugin must remain declared',
  );
});
