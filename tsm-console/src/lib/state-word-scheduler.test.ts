/**
 * Tests for the published 16-bit B/D/C/T/S/R state-word layout and scheduler.
 */
import { describe, expect, it } from 'vitest';
import {
  assertValidStateWord,
  decodeStateWord,
  diffStateWords,
  didDimensionChange,
  encodeStateWord,
  getStateWordExceptionFlag,
  isValidStateWord,
  STATE_WORD_BITS,
  STATE_WORD_R_BITS,
} from './tiles-3d-renderer-layer';
import {
  chunksToFetch,
  chunksToRelease,
  degradeWord,
  resolveHomeTile,
  scheduleFrame,
} from './state-word-scheduler';

const state = (partial: Partial<{
  B: number;
  D: number;
  C: number;
  T: number;
  S: number;
}> = {}) => encodeStateWord({
  B: partial.B ?? 0,
  D: partial.D ?? 0,
  C: partial.C ?? 0,
  T: partial.T ?? 0,
  S: partial.S ?? 0,
});

describe('published state-word bit layout', () => {
  it('covers exactly 16 non-overlapping bits including the R extension field', () => {
    const ranges = [
      ...Object.values(STATE_WORD_BITS).map(({ offset, mask }) => ({
        start: offset,
        end: offset + Math.ceil(Math.log2(mask + 1)),
      })),
      {
        start: STATE_WORD_R_BITS.offset,
        end: STATE_WORD_R_BITS.offset + Math.ceil(Math.log2(STATE_WORD_R_BITS.mask + 1)),
      },
    ].sort((a, b) => a.start - b.start);

    let cursor = 0;
    for (const range of ranges) {
      expect(range.start).toBe(cursor);
      cursor = range.end;
    }
    expect(cursor).toBe(16);
  });

  it('matches the paper encoding example 0xF4D0', () => {
    const word = encodeStateWord({ B: 3, D: 3, C: 2, T: 3, S: 2 });
    expect(word).toBe(0xF4D0);
    expect(decodeStateWord(word, 'B')).toBe(3);
    expect(decodeStateWord(word, 'D')).toBe(3);
    expect(decodeStateWord(word, 'C')).toBe(2);
    expect(decodeStateWord(word, 'T')).toBe(3);
    expect(decodeStateWord(word, 'S')).toBe(2);
    expect(getStateWordExceptionFlag(word)).toBe(false);
  });

  it('rejects unknown levels and reserved R bits rather than scheduling them', () => {
    expect(() => encodeStateWord({ B: 4, D: 0, C: 0, T: 0, S: 0 })).toThrow(/B level/);
    expect(() => encodeStateWord({ B: 0, D: 0, C: 4, T: 0, S: 0 })).toThrow(/C level/);
    expect(() => assertValidStateWord(4 << STATE_WORD_BITS.C.offset)).toThrow(/reserved/);
    expect(() => assertValidStateWord(0x0002)).toThrow(/R bits/);
    expect(isValidStateWord(0x0000)).toBe(true);
    expect(isValidStateWord(0xFFFF)).toBe(false);
    expect(() => decodeStateWord(0x10000, 'B')).toThrow(/unsigned 16-bit/);
  });

  it('encodes only the documented R exception flag', () => {
    const word = encodeStateWord({ B: 0, D: 1, C: 2, T: 3, S: 2 }, { exceptionFlag: true });
    expect(word & STATE_WORD_R_BITS.mask).toBe(1);
    expect(getStateWordExceptionFlag(word)).toBe(true);
    expect(() => assertValidStateWord(word | 0x2)).toThrow(/R bits/);
  });

  it('detects changes by dimension and validates both words', () => {
    const previous = state({ B: 1, D: 2, C: 1, T: 1, S: 1 });
    const next = state({ B: 1, D: 2, C: 1, T: 3, S: 1 });
    expect(diffStateWords(previous, next)).not.toBe(0);
    expect(didDimensionChange(previous, next, 'T')).toBe(true);
    expect(didDimensionChange(previous, next, 'B')).toBe(false);
    expect(didDimensionChange(previous, next, 'D')).toBe(false);
    expect(didDimensionChange(previous, next, 'C')).toBe(false);
    expect(didDimensionChange(previous, next, 'S')).toBe(false);
    expect(() => diffStateWords(previous, 4 << STATE_WORD_BITS.C.offset)).toThrow(/reserved/);
  });
});

describe('degradeWord', () => {
  it('degrades T then C then S, never B or D, and flags the constrained state', () => {
    const word = state({ B: 3, D: 2, C: 2, T: 3, S: 2 });
    const degraded = degradeWord(word, 5);
    expect(decodeStateWord(degraded, 'B')).toBe(3);
    expect(decodeStateWord(degraded, 'D')).toBe(2);
    expect(decodeStateWord(degraded, 'T')).toBe(0);
    expect(decodeStateWord(degraded, 'C')).toBe(0);
    expect(decodeStateWord(degraded, 'S')).toBe(2);
    expect(getStateWordExceptionFlag(degraded)).toBe(true);
  });

  it('skips zero-level dimensions rather than wasting a degradation step', () => {
    const word = state({ T: 0, C: 0, S: 2 });
    const degraded = degradeWord(word, 1);
    expect(decodeStateWord(degraded, 'T')).toBe(0);
    expect(decodeStateWord(degraded, 'C')).toBe(0);
    expect(decodeStateWord(degraded, 'S')).toBe(1);
    expect(getStateWordExceptionFlag(degraded)).toBe(true);
  });

  it('does not set the exception flag if no degradation occurs', () => {
    const word = state();
    expect(degradeWord(word, 1)).toBe(word);
    expect(getStateWordExceptionFlag(degradeWord(word, 0))).toBe(false);
  });

  it('rejects invalid words and step counts', () => {
    expect(() => degradeWord(4 << STATE_WORD_BITS.C.offset, 1)).toThrow(/reserved/);
    expect(() => degradeWord(state(), -1)).toThrow(/non-negative integer/);
    expect(() => degradeWord(state(), 1.5)).toThrow(/non-negative integer/);
  });
});

describe('chunksToFetch / chunksToRelease', () => {
  it('fetches only dimensions whose levels increased', () => {
    const prev = state({ T: 0 });
    const next = state({ T: 3 });
    expect(chunksToFetch(prev, next)).toEqual(['T']);
    expect(chunksToRelease(prev, next)).toEqual([]);
  });

  it('releases only dimensions whose levels decreased', () => {
    const prev = state({ T: 3, S: 2 });
    const next = state({ T: 1, S: 2 });
    expect(chunksToRelease(prev, next)).toEqual(['T']);
    expect(chunksToFetch(prev, next)).toEqual([]);
  });

  it('ignores a change to the R exception flag when dimensions are unchanged', () => {
    const prev = state({ T: 2 });
    const next = encodeStateWord({ B: 0, D: 0, C: 0, T: 2, S: 0 }, { exceptionFlag: true });
    expect(chunksToFetch(prev, next)).toEqual([]);
    expect(chunksToRelease(prev, next)).toEqual([]);
  });
});

describe('resolveHomeTile', () => {
  it('uses a preassigned home tile or falls back to object ID', () => {
    expect(resolveHomeTile({ objectId: 'a', homeTileId: 'h1' })).toBe('h1');
    expect(resolveHomeTile({ objectId: 'a' })).toBe('a');
  });

  it('rejects empty IDs rather than creating an ambiguous semantic route', () => {
    expect(() => resolveHomeTile({ objectId: '' })).toThrow(/objectId/);
    expect(() => resolveHomeTile({ objectId: 'a', homeTileId: '  ' })).toThrow(/homeTileId/);
  });
});

describe('scheduleFrame', () => {
  it('produces fetch plans and unchanged target words without pressure', () => {
    const currentWord = state();
    const targetWord = state({ T: 1 });
    const plan = scheduleFrame(
      [{ objectId: 'b1', homeTileId: 't0', currentWord, targetWord }],
      { vramMB: 4000, fps: 60 },
    );
    expect(plan.targets).toEqual([{ objectId: 'b1', targetWord }]);
    expect(plan.fetch).toEqual([{ objectId: 'b1', dims: ['T'] }]);
    expect(plan.release).toHaveLength(0);
  });

  it('degrades on low FPS and returns the flagged target word', () => {
    const full = state({ D: 2, C: 2, T: 3, S: 2 });
    const plan = scheduleFrame(
      [{ objectId: 'b1', homeTileId: 't0', currentWord: full, targetWord: full }],
      { vramMB: 4000, fps: 12 },
    );
    const target = plan.targets[0].targetWord;
    expect(decodeStateWord(target, 'T')).toBe(2);
    expect(getStateWordExceptionFlag(target)).toBe(true);
    expect(plan.release).toEqual([{ objectId: 'b1', dims: ['T'] }]);
    expect(plan.fetch).toHaveLength(0);
  });

  it('uses available-VRAM budget even when FPS is healthy', () => {
    const full = state({ C: 1, T: 1, S: 1 });
    const plan = scheduleFrame(
      [{ objectId: 'b1', homeTileId: 't0', currentWord: full, targetWord: full }],
      { vramMB: 512, fps: 60, minVramMB: 1024 },
    );
    expect(getStateWordExceptionFlag(plan.targets[0].targetWord)).toBe(true);
    expect(decodeStateWord(plan.targets[0].targetWord, 'T')).toBe(0);
    expect(plan.release).toEqual([{ objectId: 'b1', dims: ['T'] }]);
  });

  it('supports custom VRAM threshold and validates budget inputs', () => {
    const full = state({ T: 2 });
    const plan = scheduleFrame(
      [{ objectId: 'b1', homeTileId: 't0', currentWord: full, targetWord: full }],
      { vramMB: 512, fps: 60, minVramMB: 256 },
    );
    expect(plan.targets[0].targetWord).toBe(full);
    expect(() => scheduleFrame([], { vramMB: -1, fps: 60 })).toThrow(/vramMB/);
    expect(() => scheduleFrame([], { vramMB: 1000, fps: Number.NaN })).toThrow(/fps/);
  });

  it('rejects invalid state words and missing identity', () => {
    expect(() => scheduleFrame(
      [{ objectId: 'b1', homeTileId: 't0', currentWord: 4 << STATE_WORD_BITS.C.offset, targetWord: state() }],
      { vramMB: 4000, fps: 60 },
    )).toThrow(/reserved/);
    expect(() => scheduleFrame(
      [{ objectId: '', homeTileId: 't0', currentWord: state(), targetWord: state() }],
      { vramMB: 4000, fps: 60 },
    )).toThrow(/objectId/);
  });
});
