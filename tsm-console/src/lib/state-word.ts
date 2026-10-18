/** Shared 16-bit state-word bit layout and pure decode helpers. */
export const STATE_WORD_BITS = {
  B: { offset: 0, mask: 0x7 },
  D: { offset: 3, mask: 0x7 },
  C: { offset: 6, mask: 0x7 },
  T: { offset: 9, mask: 0xf },
  S: { offset: 13, mask: 0x7 },
} as const;

export type StateWordDimension = keyof typeof STATE_WORD_BITS;

export function decodeStateWord(word: number, dim: StateWordDimension): number {
  if (!Number.isInteger(word) || word < 0 || word > 0xffff) {
    throw new RangeError('State word must be an unsigned 16-bit integer.');
  }
  const { offset, mask } = STATE_WORD_BITS[dim];
  return (word >> offset) & mask;
}

export function diffStateWords(prev: number, next: number): number {
  if (!Number.isInteger(prev) || prev < 0 || prev > 0xffff ||
      !Number.isInteger(next) || next < 0 || next > 0xffff) {
    throw new RangeError('State words must be unsigned 16-bit integers.');
  }
  return prev ^ next;
}

export function didDimensionChange(prev: number, next: number, dim: StateWordDimension): boolean {
  return decodeStateWord(prev, dim) !== decodeStateWord(next, dim);
}
