import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const view = readFileSync(new URL('../src/routes/CesiumRegionalTwinView.tsx', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/lib/cesium-regional-scene.ts', import.meta.url), 'utf8');

test('screening view supplies source-grid bounds, columns and rows to the raster renderer', () => {
  assert.match(renderer, /async setScreening\(level: number \| null, bounds\?: ScreeningBounds, cols\?: number, rows\?: number\)/);
  assert.match(view, /scene\.current\.setScreening\(level, frame\?\.bounds, frame\?\.cols, frame\?\.rows\)/,
    'Do not invoke the raster renderer without the audited image grid dimensions');
});
