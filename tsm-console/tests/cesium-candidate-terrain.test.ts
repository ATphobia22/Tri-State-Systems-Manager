import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ION_CATALOG, type TerrainPreviewSource } from '../src/lib/cesium-ion-assets';

const read = (file: string) =>
  readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');

describe('user-provided ion terrain 2426648 preview contract', () => {
  it('registers asset ID only, without promoting the candidate to verified data', () => {
    expect(ION_CATALOG.terrainCandidate2426648).toBe(2426648);
    const mode: TerrainPreviewSource = 'candidate2426648';
    expect(mode).toBe('candidate2426648');
  });
  it('does not replace the local USGS terrain by default or require private credentials', () => {
    const scene = read('lib/cesium-regional-scene.ts');
    expect(scene).toContain("let terrainSource: TerrainPreviewSource = 'local'");
    expect(scene).toContain('CesiumTerrainProvider.fromIonAssetId(ION_CATALOG.terrainCandidate2426648)');
    expect(scene).toContain('if (source !== \'local\' && !ionToken)');
    expect(scene).toContain('generation !== terrainRequest');
    expect(scene).toContain('return false');
    expect(scene).toContain('UNVERIFIED terrain preview');
    expect(scene).not.toContain('ion.cesium.com/tokens/');
  });
  it('labels the preview as unverified and retains a functional fallback in the UI', () => {
    const view = read('routes/CesiumRegionalTwinView.tsx');
    expect(view).toContain('value="candidate2426648" disabled={!ION_ENABLED}');
    expect(view).toContain('license, coverage, vertical datum or elevation accuracy');
    expect(view).toContain('previous terrain remains active');
    expect(view).toContain('if (applied) setTerrainSource(source)');
  });
});
