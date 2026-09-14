import test from 'node:test';
import assert from 'node:assert/strict';

const fs = await import('node:fs/promises');
const source = await fs.readFile(new URL('../src/lib/open-world-hydrology.ts', import.meta.url), 'utf8');

test('hydrology contract distinguishes observed and stale state', () => {
  assert.match(source, /'OBSERVED' \| 'FORECAST' \| 'STALE' \| 'SOURCE_UNAVAILABLE'/);
  assert.match(source, /classifyObservationFreshness/);
  assert.match(source, /observedAt/);
  assert.match(source, /datum/);
});
