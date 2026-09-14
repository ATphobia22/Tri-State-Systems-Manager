import test from 'node:test';
import assert from 'node:assert/strict';

const fs = await import('node:fs/promises');
const terrainPath = new URL('../src/lib/open-world-terrain.ts', import.meta.url);
const imageryPath = new URL('../src/lib/open-world-imagery.ts', import.meta.url);

test('terrain adapter requires CRS and vertical datum', async () => {
  const source = await fs.readFile(terrainPath, 'utf8');
  assert.match(source, /verticalDatum/);
  assert.match(source, /validateTerrainMetadata/);
});

test('imagery adapter validates source and pixel resolution', async () => {
  const source = await fs.readFile(imageryPath, 'utf8');
  assert.match(source, /pixelResolutionMeters/);
  assert.match(source, /validateImageryMetadata/);
});
