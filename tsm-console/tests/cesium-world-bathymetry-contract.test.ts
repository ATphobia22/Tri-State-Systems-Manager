import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ION_CATALOG } from '../src/lib/cesium-ion-assets';

const read = (path: string) => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');

describe('Cesium World Bathymetry remains online visualization-only', () => {
  it('registers the documented correct asset ID without replacing the local default', () => {
    expect(ION_CATALOG.worldBathymetry).toBe(2426648);
    expect(ION_CATALOG.worldTerrain).toBe(1);
    const view = read('routes/CesiumRegionalTwinView.tsx');
    expect(view).toContain("useState<IonTerrainSource>('local')");
    expect(view).toContain('World Bathymetry · 2426648 (global/ocean context only)');
    expect(view).toContain('not surveyed Ohio–Wabash riverbed data');
    expect(view).toContain('disabled={!ION_ENABLED}');
  });
  it('keeps unapproved ion assets token-gated and retains the previous terrain on error', () => {
    const scene = read('lib/cesium-regional-scene.ts');
    expect(scene).toContain("if (source !== 'local' && !ionToken)");
    expect(scene).toContain('CesiumTerrainProvider.fromIonAssetId(ION_CATALOG.worldBathymetry)');
    expect(scene).toContain('generation !== terrainRequest');
    expect(scene).toContain('existing view retained');
    expect(scene).toContain("source === 'bathymetry' ? bathymetryTerrain");
    expect(scene).not.toContain("terrainSource = source;\n      try");
  });
});