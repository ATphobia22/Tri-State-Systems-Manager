/** Tests for the 16-bit B-D-C-T-S state-word scheduler. */
import { describe, expect, it } from 'vitest';
import {
  decodeStateWord,
  decodeStateWordExtension,
  diffStateWords,
  didDimensionChange,
  encodeStateWord,
  STATE_WORD_BITS,
  STATE_WORD_EXTENSION_BITS,
} from '../lib/tiles-3d-renderer-layer';
import {
  chunksToFetch,
  chunksToRelease,
  degradeWord,
  resolveHomeTile,
  scheduleFrame,
} from '../lib/state-word-scheduler';

const state = (B: number, D: number, C: number, T: number, S: number, R = 0) =>
  encodeStateWord({ B, D, C, T, S }, R);

describe('published state-word bit layout', () => {
  it('covers exactly 16 bits with no overlap, including the R extension', () => {
    const ranges = [
      ...Object.values(STATE_WORD_BITS),
      STATE_WORD_EXTENSION_BITS,
    ].map(({ offset, mask }) => {
      const width = Math.ceil(Math.log2(mask + 1));
      return { start: offset, end: offset + width };
    });
    ranges.sort((a, b) => a.start - b.start);
    let cursor = 0;
    for (const range of ranges) {
      expect(range.start).toBe(cursor);
      cursor = range.end;
    }
    expect(cursor).toBe(16);
  });

  it('encodes and decodes every legal B-D-C-T-S combination and R value', () => {
    for (let B = 0; B <= 3; B++) {
      for (let D = 0; D <= 3; D++) {
        for (let C = 0; C <= 3; C++) {
          for (let T = 0; T <= 3; T++) {
            for (let S = 0; S <= 3; S++) {
              for (let R = 0; R <= 7; R++) {
                const word = state(B, D, C, T, S, R);
                if (
                  decodeStateWord(word, 'B') !== B ||
                  decodeStateWord(word, 'D') !== D ||
                  decodeStateWord(word, 'C') !== C ||
                  decodeStateWord(word, 'T') !== T ||
                  decodeStateWord(word, 'S') !== S ||
                  decodeStateWordExtension(word) !== R
                ) {
                  throw new Error(`State-word round-trip mismatch: ${word}`);
                }
              }
            }
          }
        }
      }
    }
    expect(true).toBe(true);
  });

  it('rejects out-of-range words, reserved levels, and illegal field values', () => {
    expect(() => decodeStateWord(-1, 'B')).toThrow(RangeError);
    expect(() => decodeStateWord(1.5, 'B')).toThrow(RangeError);
    expect(() => decodeStateWord(0x10000, 'B')).toThrow(RangeError);
    expect(() => decodeStateWord(4 << STATE_WORD_BITS.C.offset, 'B')).toThrow(RangeError);
    expect(() => decodeStateWord(4 << STATE_WORD_BITS.T.offset, 'T')).toThrow(RangeError);
    expect(() => decodeStateWord(4 << STATE_WORD_BITS.S.offset, 'S')).toThrow(RangeError);
    expect(() => diffStateWords(0, -1)).toThrow(RangeError);
    expect(() => state(4, 0, 0, 0, 0)).toThrow(RangeError);
    expect(() => state(0, 4, 0, 0, 0)).toThrow(RangeError);
    expect(() => state(0, 0, 4, 0, 0)).toThrow(RangeError);
    expect(() => state(0, 0, 0, 4, 0)).toThrow(RangeError);
    expect(() => state(0, 0, 0, 0, 4)).toThrow(RangeError);
    expect(() => encodeStateWord({ B: 0, D: 0, C: 0, T: 0, S: 0 }, 8)).toThrow(RangeError);
  });

  it('keeps the R extension separate from B-D-C-T-S change detection', () => {
    const previous = state(1, 2, 3, 1, 2, 0);
    const next = state(1, 2, 3, 1, 2, 1);
    expect(diffStateWords(previous, next)).toBe(1);
    for (const dimension of ['B', 'D', 'C', 'T', 'S'] as const) {
      expect(didDimensionChange(previous, next, dimension)).toBe(false);
    }
    expect(decodeStateWordExtension(next)).toBe(1);
  });

  it('detects changes in one dimension only', () => {
    const previous = state(1, 2, 1, 1, 2);
    const next = state(1, 2, 1, 3, 2);
    expect(diffStateWords(previous, next)).not.toBe(0);
    expect(didDimensionChange(previous, next, 'T')).toBe(true);
    expect(didDimensionChange(previous, next, 'B')).toBe(false);
    expect(didDimensionChange(previous, next, 'D')).toBe(false);
    expect(didDimensionChange(previous, next, 'C')).toBe(false);
    expect(didDimensionChange(previous, next, 'S')).toBe(false);
  });
});

describe('degradeWord', () => {
  it('preserves boundary proxy and geometric detail', () => {
    const word = state(3, 3, 2, 3, 2);
    const degraded = degradeWord(word, 5);
    expect(decodeStateWord(degraded, 'D')).toBe(3);
    expect(decodeStateWord(degraded, 'B')).toBe(3);
    expect(decodeStateWord(degraded, 'T')).toBe(0);
    expect(decodeStateWord(degraded, 'C')).toBe(0);
    expect(decodeStateWord(degraded, 'S')).toBe(2);
  });

  it('rejects invalid degradation step counts and invalid words', () => {
    expect(() => degradeWord(0, -1)).toThrow(RangeError);
    expect(() => degradeWord(0, 1.5)).toThrow(RangeError);
    expect(() => degradeWord(0x10000, 1)).toThrow(RangeError);
    expect(() => degradeWord(4 << STATE_WORD_BITS.C.offset, 1)).toThrow(RangeError);
  });

  it('continues to C when T is already at its minimum', () => {
    const once = degradeWord(state(2, 2, 2, 0, 2), 1);
    expect(decodeStateWord(once, 'T')).toBe(0);
    expect(decodeStateWord(once, 'C')).toBe(1);
  });

  it('reduces T first under pressure', () => {
    const once = degradeWord(state(0, 2, 2, 3, 2), 1);
    expect(decodeStateWord(once, 'T')).toBe(2);
    expect(decodeStateWord(once, 'C')).toBe(2);
  });
});

describe('chunksToFetch / chunksToRelease', () => {
  it('fetches only dimensions that increased', () => {
    const previous = state(0, 0, 0, 0, 0);
    const next = state(0, 0, 0, 3, 0);
    expect(chunksToFetch(previous, next)).toEqual(['T']);
    expect(chunksToRelease(previous, next)).toEqual([]);
  });

  it('releases only dimensions that decreased', () => {
    const previous = state(0, 0, 0, 3, 2);
    const next = state(0, 0, 0, 1, 2);
    expect(chunksToRelease(previous, next)).toEqual(['T']);
    expect(chunksToFetch(previous, next)).toEqual([]);
  });
});

describe('resolveHomeTile', () => {
  it('prefers homeTileId, falls back to objectId', () => {
    expect(resolveHomeTile({ objectId: 'a', homeTileId: 'h1' })).toBe('h1');
    expect(resolveHomeTile({ objectId: 'a' })).toBe('a');
  });
});

describe('scheduleFrame', () => {
  it('produces fetch plans without pressure', () => {
    const plan = scheduleFrame(
      [{ objectId: 'b1', homeTileId: 't0', currentWord: 0, targetWord: state(0, 0, 0, 1, 0) }],
      { vramMB: 4000, fps: 60 },
    );
    expect(plan.fetch).toHaveLength(1);
    expect(plan.fetch[0].dims).toEqual(['T']);
    expect(plan.release).toHaveLength(0);
  });

  it('degrades under reported VRAM pressure when a threshold is configured', () => {
    const full = state(2, 2, 2, 3, 2);
    const plan = scheduleFrame(
      [{ objectId: 'b1', homeTileId: 't0', currentWord: full, targetWord: full }],
      { vramMB: 128, minVramMB: 256, fps: 60 },
    );
    expect(plan.release.flatMap((feature) => feature.dims)).toContain('T');
    expect(plan.fetch).toHaveLength(0);
  });

  it('supports FPS-only fallback when VRAM telemetry is unavailable', () => {
    const plan = scheduleFrame(
      [{ objectId: 'b1', homeTileId: 't0', currentWord: 0, targetWord: state(0, 0, 0, 1, 0) }],
      { fps: 60 },
    );
    expect(plan.fetch[0].dims).toEqual(['T']);
  });

  it('rejects invalid telemetry rather than silently scheduling', () => {
    expect(() => scheduleFrame([], { vramMB: -1, fps: 60 })).toThrow(RangeError);
    expect(() => scheduleFrame([], { vramMB: 512, fps: Number.NaN })).toThrow(RangeError);
    expect(() => scheduleFrame([], { vramMB: 512, fps: 60, minVramMB: -1 })).toThrow(RangeError);
  });

  it('degrades under FPS pressure instead of fetching up', () => {
    const full = state(2, 2, 2, 3, 2);
    const plan = scheduleFrame(
      [{ objectId: 'b1', homeTileId: 't0', currentWord: full, targetWord: full }],
      { vramMB: 512, fps: 12 },
    );
    expect(plan.release.flatMap((feature) => feature.dims)).toContain('T');
    expect(plan.fetch).toHaveLength(0);
  });
});
