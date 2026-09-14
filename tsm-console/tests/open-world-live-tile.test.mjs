import test from 'node:test';
import assert from 'node:assert/strict';

const fs = await import('node:fs/promises');
const source = await fs.readFile(new URL('../src/lib/open-world-live-tile.ts', import.meta.url), 'utf8');

test('live tile helper uses Web Mercator bounds and ArcGIS exportImage', () => {
  assert.match(source, /tileBounds3857/);
  assert.match(source, /exportImage/);
  assert.match(source, /bboxSR.*3857/);
  assert.match(source, /imageSR.*3857/);
});

test('live tile helper keeps 512px tile size as the default', () => {
  assert.match(source, /size = 512/);
});
