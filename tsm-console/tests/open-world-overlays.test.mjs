import test from 'node:test';
import assert from 'node:assert/strict';

const fs = await import('node:fs/promises');

test('open-world overlays preserve separate floodplain and cadastral layers', async () => {
  const source = await fs.readFile(new URL('../src/lib/open-world-overlays.ts', import.meta.url), 'utf8');
  assert.match(source, /fema-effective/);
  assert.match(source, /indiana-bafm/);
  assert.match(source, /indiana-parcels-2025/);
  assert.match(source, /usace-nld/);
});

test('historical adapter cannot promote historical evidence', async () => {
  const source = await fs.readFile(new URL('../src/lib/historical-point-township.ts', import.meta.url), 'utf8');
  assert.match(source, /source.state !== 'HISTORICAL'/);
  assert.match(source, /HISTORICAL/);
});
