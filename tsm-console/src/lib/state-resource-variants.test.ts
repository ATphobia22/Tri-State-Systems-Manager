/**
 * Tests for StateResourceManager: word -> resource manifest mapping and
 * fetch-list diffing on top of the scheduler's chunksToFetch/chunksToRelease.
 */
import { describe, expect, it } from 'vitest';
import { encodeStateWord } from '../lib/state-word-codec';
import { StateResourceManager } from '../lib/state-resource-variants';

function mgr() {
  return new StateResourceManager({ baseUrl: 'https://tiles.example.com/tsm/', objectPath: 'bldg-123' });
}

describe('StateResourceManager', () => {
  it('rejects empty baseUrl', () => {
    expect(() => new StateResourceManager({ baseUrl: '' })).toThrow(RangeError);
  });

  it('maps a word to concrete variant descriptors', () => {
    const m = mgr();
    // B=1 (bbox), D=2 (lod2), C=2 (shell+roof+openings), T=2 (1024px), S=1 (basic)
    const word = encodeStateWord({ B: 1, D: 2, C: 2, T: 2, S: 1 });
    const manifest = m.getVariantForWord(word);

    expect(manifest.word).toBe(word);
    expect(manifest.geometry.lod).toBe('lod2');
    expect(manifest.geometry.url).toBe('https://tiles.example.com/tsm/bldg-123/mesh-l2.glb');
    expect(manifest.geometry.estimatedTriangles).toBe(8_000);
    expect(manifest.texture.resolutionPx).toBe(1024);
    expect(manifest.texture.url).toBe('https://tiles.example.com/tsm/bldg-123/atlas-l2.ktx2');
    expect(manifest.components.activeComponents).toEqual(['shell', 'roof', 'openings']);
    expect(manifest.boundary.kind).toBe('bbox');
    expect(manifest.semantics.tier).toBe('basic');
    expect(manifest.estimatedBytes).toBe(
      manifest.geometry.estimatedBytes + manifest.texture.estimatedBytes,
    );
  });

  it('level 0 texture is untextured with null url', () => {
    const m = mgr();
    const word = encodeStateWord({ B: 0, D: 1, C: 0, T: 0, S: 0 });
    const manifest = m.getVariantForWord(word);
    expect(manifest.texture.resolutionPx).toBe(0);
    expect(manifest.texture.url).toBeNull();
    expect(manifest.texture.estimatedBytes).toBe(0);
  });

  it('level 0 geometry uses the proxy asset', () => {
    const m = mgr();
    const word = encodeStateWord({ B: 0, D: 0, C: 0, T: 0, S: 0 });
    const manifest = m.getVariantForWord(word);
    expect(manifest.geometry.lod).toBe('proxy');
    expect(manifest.geometry.url).toContain('proxy-l0.glb');
  });

  it('rejects invalid words', () => {
    const m = mgr();
    // C=4 exceeds the permitted 0-3 range (C mask is 0x7, so 4-7 are reserved).
    expect(() => m.getVariantForWord(0x4 << 9)).toThrow(RangeError);
    expect(() => m.getVariantForWord(-1)).toThrow(RangeError);
  });

  it('getFetchList diffs increased dims as load, decreased as unload', () => {
    const m = mgr();
    const current = encodeStateWord({ B: 1, D: 1, C: 1, T: 2, S: 1 });
    const target = encodeStateWord({ B: 1, D: 2, C: 1, T: 1, S: 1 });
    const { load, unload } = m.getFetchList(current, target);

    // D went 1 -> 2: load lod2 geometry.
    expect(load).toHaveLength(1);
    expect(load[0].dimension).toBe('D');
    expect(load[0].level).toBe(2);
    expect(load[0].kind).toBe('geometry');
    expect((load[0].descriptor as { lod: string }).lod).toBe('lod2');

    // T went 2 -> 1: unload the 1024px texture (current level's descriptor).
    expect(unload).toHaveLength(1);
    expect(unload[0].dimension).toBe('T');
    expect(unload[0].level).toBe(2);
    expect(unload[0].kind).toBe('texture');
    expect((unload[0].descriptor as { resolutionPx: number }).resolutionPx).toBe(1024);
  });

  it('getFetchList is empty for identical words', () => {
    const m = mgr();
    const word = encodeStateWord({ B: 2, D: 2, C: 2, T: 2, S: 2 });
    expect(m.getFetchList(word, word)).toEqual({ load: [], unload: [] });
  });

  it('getFetchList handles multi-dimension upgrades', () => {
    const m = mgr();
    const current = encodeStateWord({ B: 0, D: 0, C: 0, T: 0, S: 0 });
    const target = encodeStateWord({ B: 0, D: 3, C: 0, T: 3, S: 0 });
    const { load, unload } = m.getFetchList(current, target);
    expect(load.map((e) => e.dimension).sort()).toEqual(['D', 'T']);
    expect(unload).toEqual([]);
    const geom = load.find((e) => e.dimension === 'D');
    expect((geom?.descriptor as { lod: string }).lod).toBe('lod2-detail');
  });

  it('normalizes baseUrl and objectPath slashes', () => {
    const m = new StateResourceManager({ baseUrl: 'https://x.example/', objectPath: '/obj/' });
    const word = encodeStateWord({ B: 0, D: 1, C: 0, T: 1, S: 0 });
    const manifest = m.getVariantForWord(word);
    expect(manifest.geometry.url).toBe('https://x.example/obj/mesh-l1.glb');
    expect(manifest.texture.url).toBe('https://x.example/obj/atlas-l1.ktx2');
  });

  it('works without objectPath', () => {
    const m = new StateResourceManager({ baseUrl: 'https://x.example/tiles' });
    const word = encodeStateWord({ B: 0, D: 1, C: 0, T: 0, S: 0 });
    expect(m.getVariantForWord(word).geometry.url).toBe('https://x.example/tiles/mesh-l1.glb');
  });
});
