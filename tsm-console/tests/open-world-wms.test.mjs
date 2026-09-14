import test from 'node:test';
import assert from 'node:assert/strict';

const fs = await import('node:fs/promises');
const source = await fs.readFile(new URL('../src/lib/open-world-wms.ts', import.meta.url), 'utf8');

test('ArcGIS WMS tile template uses MapLibre Web Mercator bbox token', () => {
  assert.match(source, /BBOX=\{bbox-epsg-3857\}/);
  assert.match(source, /CRS=EPSG:3857/);
  assert.match(source, /FORMAT=image\/png/);
});

test('live sources are the verified Indiana imagery and USGS 3DEP services', () => {
  assert.match(source, /Indiana_Current_Imagery\/ImageServer/);
  assert.match(source, /3DEPElevation\/ImageServer/);
});
