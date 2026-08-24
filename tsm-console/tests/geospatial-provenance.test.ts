import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { POSEY_2020_ASSETS } from '../src/geospatial/site-asset-manifest';

describe('Posey geospatial provenance', () => {
  it('requires authoritative source URIs for both bound assets', () => {
    expect(POSEY_2020_ASSETS.terrain.authorityClass).toBe('OBSERVATION');
    expect(POSEY_2020_ASSETS.terrain.derivationClass).toBe('RAW');
    expect(POSEY_2020_ASSETS.orthophoto.authorityClass).toBe('OBSERVATION');
    expect(POSEY_2020_ASSETS.orthophoto.derivationClass).toBe('RAW');
    expect(POSEY_2020_ASSETS.terrain.referenceLidarUri).toContain('IN2020_26800940_12.las');
  });

  it('keeps the frontend evidence state distinct from a backend evidentiary seal', async () => {
    const source = await readFile(new URL('../src/routes/CinematicHudView.tsx', import.meta.url), 'utf8');
    expect(source).toContain('BACKEND-SEAL REQUIRED');
    expect(source).toContain('OBSERVATION BOUND');
    expect(source).toContain('MODEL/UI · BACKEND-SEAL REQUIRED');
  });
});
