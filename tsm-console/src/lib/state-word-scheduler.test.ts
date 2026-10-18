/**
 * Tests for the 5D state-word scheduler and bit-layout helpers.
 * Research basis: mapping-planes-lod-integration-20261018-0426
 */
import { describe, expect, it } from 'vitest';
import {
  decodeStateWord,
  diffStateWords,
  didDimensionChange,
  STATE_WORD_BITS,
} from '../lib/tiles-3d-renderer-layer';
import {
  chunksToFetch,
  chunksToRelease,
  degradeWord,
  resolveHomeTile,
  scheduleFrame,
} from '../lib/state-word-scheduler';

describe('state-word bit layout', () => {
  it('covers exactly 16 bits with no overlap', () => {
    const ranges = Object.values(STATE_WORD_BITS).map(({ offset, mask }) => {
      const width = Math.ceil(Math.log2(mask + 1));
      return { start: offset, end: offset + width };
    });
    ranges.sort((a, b) => a.start - b.start);
    expect(ranges[0].start).toBe(0);
    let cursor = 0;
    for (const r of ranges) {
      expect(r.start).toBe(cursor);
      cursor = r.end;
    }
    expect(cursor).toBe(16);
  });

  it('rejects values outside the unsigned 16-bit domain', () => {
    expect(() => decodeStateWord(-1, 'B')).toThrow(RangeError);
    expect(() => decodeStateWord(1.5, 'B')).toThrow(RangeError);
    expect(() => decodeStateWord(0x10000, 'B')).toThrow(RangeError);
    expect(() => diffStateWords(0, -1)).toThrow(RangeError);
  });

  it('decodes each dimension independently', () => {
    // word: B=5, D=3, C=2, T=9, S=4
    const word = (5 << 0) | (3 << 3) | (2 << 6) | (9 << 9) | (4 << 13);
    expect(decodeStateWord(word, 'B')).toBe(5);
    expect(decodeStateWord(word, 'D')).toBe(3);
    expect(decodeStateWord(word, 'C')).toBe(2);
    expect(decodeStateWord(word, 'T')).toBe(9);
    expect(decodeStateWord(word, 'S')).toBe(4);
  });

  it('XOR-diff detects changed dimensions only', () => {
    const a = (1 << 0) | (2 << 3) | (1 << 6) | (3 << 9) | (1 << 13);
    const b = (1 << 0) | (2 << 3) | (1 << 6) | (7 << 9) | (1 << 13); // T changed
    expect(diffStateWords(a, b)).not.toBe(0);
    expect(didDimensionChange(a, b, 'T')).toBe(true);
    expect(didDimensionChange(a, b, 'B')).toBe(false);
    expect(didDimensionChange(a, b, 'D')).toBe(false);
    expect(didDimensionChange(a, b, 'C')).toBe(false);
    expect(didDimensionChange(a, b, 'S')).toBe(false);
  });
});

describe('degradeWord', () => {
  it('rejects invalid degradation step counts', () => {
    expect(() => degradeWord(0, -1)).toThrow(RangeError);
    expect(() => degradeWord(0, 1.5)).toThrow(RangeError);
    expect(() => degradeWord(0x10000, 1)).toThrow(RangeError);
  });

  it('never degrades geometric detail (D)', () => {
    const word = (3 << 0) | (4 << 3) | (2 << 6) | (8 << 9) | (2 << 13);
    const degraded = degradeWord(word, 5);
    expect(decodeStateWord(degraded, 'D')).toBe(4);
    expect(decodeStateWord(degraded, 'B')).toBe(3);
  });

  it('continues to C when T is already at its minimum', () => {
    const word = (2 << 3) | (2 << 6) | (0 << 9) | (2 << 13);
    const once = degradeWord(word, 1);
    expect(decodeStateWord(once, 'T')).toBe(0);
    expect(decodeStateWord(once, 'C')).toBe(1);
  });

  it('reduces T first under pressure', () => {
    const word = (0 << 0) | (2 << 3) | (2 << 6) | (8 << 9) | (2 << 13);
    const once = degradeWord(word, 1);
    expect(decodeStateWord(once, 'T')).toBe(7);
    expect(decodeStateWord(once, 'C')).toBe(2);
  });
});

describe('chunksToFetch / chunksToRelease', () => {
  it('fetches only dimensions that increased', () => {
    const prev = (0 << 9) | (0 << 13); // T=0 S=0
    const next = (3 << 9) | (0 << 13); // T=3 S=0
    expect(chunksToFetch(prev, next)).toEqual(['T']);
    expect(chunksToRelease(prev, next)).toEqual([]);
  });

  it('releases only dimensions that decreased', () => {
    const prev = (3 << 9) | (2 << 13);
    const next = (1 << 9) | (2 << 13);
    expect(chunksToRelease(prev, next)).toEqual(['T']);
    expect(chunksToFetch(prev, next)).toEqual([]);
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
      [{ objectId: 'b1', homeTileId: 't0', currentWord: 0, targetWord: 1 << 9 }],
      { vramMB: 4000, fps: 60 },
    );
    expect(plan.fetch).toHaveLength(1);
    expect(plan.fetch[0].dims).toEqual(['T']);
    expect(plan.release).toHaveLength(0);
  });

  it('degrades under reported VRAM pressure when a threshold is configured', () => {
    const full = (2 << 3) | (2 << 6) | (8 << 9) | (2 << 13);
    const plan = scheduleFrame(
      [{ objectId: 'b1', homeTileId: 't0', currentWord: full, targetWord: full }],
      { vramMB: 128, minVramMB: 256, fps: 60 },
    );
    expect(plan.release.flatMap((f) => f.dims)).toContain('T');
    expect(plan.fetch).toHaveLength(0);
  });

  it('rejects invalid telemetry rather than silently scheduling', () => {
    expect(() => scheduleFrame([], { vramMB: -1, fps: 60 })).toThrow(RangeError);
    expect(() => scheduleFrame([], { vramMB: 512, fps: Number.NaN })).toThrow(RangeError);
    expect(() => scheduleFrame([], { vramMB: 512, fps: 60, minVramMB: -1 })).toThrow(RangeError);
  });

  it('degrades under FPS pressure instead of fetching up', () => {
    const full = (2 << 3) | (2 << 6) | (8 << 9) | (2 << 13);
    const plan = scheduleFrame(
      [{ objectId: 'b1', homeTileId: 't0', currentWord: full, targetWord: full }],
      { vramMB: 512, fps: 12 },
    );
    // Under pressure the target degrades (T 8 -> 7): expect a release of T, no fetch.
    const releasedT = plan.release.flatMap((f) => f.dims).includes('T');
    expect(releasedT).toBe(true);
    expect(plan.fetch).toHaveLength(0);
  });
});
