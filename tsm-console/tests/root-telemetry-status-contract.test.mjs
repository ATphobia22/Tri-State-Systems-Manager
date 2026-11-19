import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/components/RootLayout.tsx', import.meta.url), 'utf8',
);

test('global gauge banner is scoped to initial loader state, not mistaken for manually fetched gauges', () => {
  assert.match(source, /No river observation is preloaded in the global status context\./);
  assert.match(source, /Use the River Watch or map gauge controls to request official USGS snapshots/);
  assert.match(source, /readings may be provisional or unavailable/);
  assert.match(source, /No continuous telemetry or NAVD88 conversion is inferred/);
  assert.doesNotMatch(source, /Live hydrologic telemetry unavailable\. No continuity is fabricated/);
});
