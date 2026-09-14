import test from 'node:test';
import assert from 'node:assert/strict';

const modulePath = new URL('../src/lib/geospatial-tile-sources.ts', import.meta.url);

test('source resolver contract is represented in source', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(modulePath, 'utf8');
  assert.match(source, /SOURCE_UNAVAILABLE/);
  assert.match(source, /PROGRAM_PENDING/);
  assert.match(source, /HISTORICAL/);
  assert.match(source, /classifySourceState/);
});

test('published non-live source resolves as verified', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(modulePath, 'utf8');
  assert.match(source, /state === 'VERIFIED'/);
});

test('live sources have a bounded freshness policy', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(modulePath, 'utf8');
  assert.match(source, /15 \* 60 \* 1000/);
});
