import test from 'node:test';
import assert from 'node:assert/strict';

const fs = await import('node:fs/promises');

test('historical Point Township adapter is explicitly reference-only', async () => {
  const source = await fs.readFile(new URL('../src/lib/historical-point-township.ts', import.meta.url), 'utf8');
  assert.match(source, /HISTORICAL/);
  assert.match(source, /must remain classified/);
});
