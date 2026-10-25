import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('public geoid demo exposes regional samples, never parcel/site anchors', async () => {
  const catalog = JSON.parse(await readFile(
    new URL('../public/data/geoid/posey-geoid18-aoi-samples.json', import.meta.url), 'utf8',
  ));
  assert.ok(catalog.points.length >= 1, 'regional educational samples still available');
  assert.ok(catalog.points.every((point) =>
    !/(?:residential|parcel|home|site|anchor)/i.test(point.id)));
  assert.equal(catalog.authorityClass, 'DERIVED');
  assert.equal(catalog.verticalDatum, 'NAVD88');
});

test('public twin starts at approximate region rather than a residence', async () => {
  const code = await readFile(
    new URL('../src/components/RealWorldTwinMap.tsx', import.meta.url), 'utf8',
  );
  assert.match(code, /const REGIONAL_CENTER: \[number, number\]/);
  assert.match(code, /center: REGIONAL_CENTER/);
  assert.doesNotMatch(code, /const ANCHOR: \[number, number\]/);
});
