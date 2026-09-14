import test from 'node:test';
import assert from 'node:assert/strict';

const fs = await import('node:fs/promises');

test('Open-World Twin source adapters are present and source-bound', async () => {
  const files = [
    '../src/lib/geospatial-tile-sources.ts',
    '../src/lib/geospatial-tile-resolver.ts',
    '../src/lib/open-world-terrain.ts',
    '../src/lib/open-world-imagery.ts',
    '../src/lib/open-world-overlays.ts',
    '../src/lib/open-world-hydrology.ts',
    '../src/lib/historical-point-township.ts',
  ];
  for (const file of files) {
    const stat = await fs.stat(new URL(file, import.meta.url));
    assert.ok(stat.isFile(), `${file} missing`);
  }
});
