import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { POSEY_2020_ASSETS, POSEY_SITE_BOUNDS } from '../src/geospatial/site-asset-manifest';

describe('Posey asset download contract', () => {
  it('pins both upstream services and the exact AOI', async () => {
    const source = await readFile(new URL('../scripts/geospatial/fetch-posey-assets.mjs', import.meta.url), 'utf8');
    expect(source).toContain(POSEY_2020_ASSETS.terrain.sourceUri);
    expect(source).toContain(POSEY_2020_ASSETS.orthophoto.sourceUri);
    expect(source).toContain(`${POSEY_SITE_BOUNDS.minX},${POSEY_SITE_BOUNDS.minY},${POSEY_SITE_BOUNDS.maxX},${POSEY_SITE_BOUNDS.maxY}`);
  });

  it('does not permit arbitrary upstream proxy URLs', async () => {
    const source = await readFile(new URL('../scripts/geospatial/fetch-posey-assets.mjs', import.meta.url), 'utf8');
    expect(source).not.toMatch(/process\.env\.[A-Z_]+_URL/);
    expect(source).toContain("Requested AOI exceeds the registered Posey site bounds");
  });
});
