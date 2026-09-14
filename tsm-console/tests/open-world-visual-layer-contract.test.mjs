import test from 'node:test';
import assert from 'node:assert/strict';

const fs = await import('node:fs/promises');

test('visual layer components expose authoritative source state', async () => {
  const terrain = await fs.readFile(new URL('../src/components/OpenWorldTerrainLayer.tsx', import.meta.url), 'utf8');
  const imagery = await fs.readFile(new URL('../src/components/OpenWorldImageryLayer.tsx', import.meta.url), 'utf8');
  for (const source of [terrain, imagery]) {
    assert.match(source, /data-source-id/);
    assert.match(source, /data-source-state/);
  }
});
