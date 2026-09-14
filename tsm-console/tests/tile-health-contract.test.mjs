import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const cwd = path.resolve(import.meta.dirname, '..');

test('tile health checker validates the committed manifest', () => {
  const result = spawnSync(process.execPath, ['scripts/geospatial/tile-health-check.mjs'], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Geospatial tile fabric healthy/);
});
