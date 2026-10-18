/**
 * Canonical, renderer-independent 16-bit state-word codec.
 *
 * Published layout: B[15:14], D[13:12], C[11:9], T[8:6], S[5:3], R[2:0].
 * The current TSM contract permits B/D/C/T/S levels 0-3 and R=0 (normal)
 * or R=1 (runtime exception). Unregistered bit patterns fail closed.
 */
export const STATE_WORD_BITS = {
  B: { offset: 14, mask: 0x3 },
  D: { offset: 12, mask: 0x3 },
  C: { offset: 9, mask: 0x7 },
  T: { offset: 6, mask: 0x7 },
  S: { offset: 3, mask: 0x7 },
} as const;

export const STATE_WORD_EXTENSION_BITS = { offset: 0, mask: 0x7 } as const;
export type StateWordDimension = keyof typeof STATE_WORD_BITS;
export type StateWordValues = Record<StateWordDimension, number>;

export function assertStateWord(word: number): void {
  if (!Number.isInteger(word) || word < 0 || word > 0xffff) {
    throw new RangeError(`State word must be an unsigned 16-bit integer; received ${word}`);
  }
}

export function assertValidStateWord(word: number): void {
  assertStateWord(word);
  for (const dim of Object.keys(STATE_WORD_BITS) as StateWordDimension[]) {
    const { offset, mask } = STATE_WORD_BITS[dim];
    const value = (word >>> offset) & mask;
    if (value > 3) throw new RangeError(`Reserved ${dim} state-word level: ${value}`);
  }
  const extension = (word >>> STATE_WORD_EXTENSION_BITS.offset) & STATE_WORD_EXTENSION_BITS.mask;
  if (extension > 1) throw new RangeError(`Reserved R extension value: ${extension}`);
}

export function encodeStateWord(values: StateWordValues, extension = 0): number {
  if (!Number.isInteger(extension) || extension < 0 || extension > 1) {
    throw new RangeError(`R extension must be 0 or 1 in the current schema; received ${extension}`);
  }
  let word = extension;
  for (const dim of Object.keys(STATE_WORD_BITS) as StateWordDimension[]) {
    const { offset } = STATE_WORD_BITS[dim];
    const value = values[dim];
    if (!Number.isInteger(value) || value < 0 || value > 3) {
      throw new RangeError(`${dim} must be an integer in [0, 3]; received ${value}`);
    }
    word |= value << offset;
  }
  return word;
}

export function decodeStateWord(word: number, dim: StateWordDimension): number {
  assertValidStateWord(word);
  const bits = STATE_WORD_BITS[dim];
  if (!bits) throw new RangeError(`Unknown state-word dimension: ${String(dim)}`);
  return (word >>> bits.offset) & bits.mask;
}

export function decodeStateWordExtension(word: number): number {
  assertValidStateWord(word);
  return (word >>> STATE_WORD_EXTENSION_BITS.offset) & STATE_WORD_EXTENSION_BITS.mask;
}

export function diffStateWords(prev: number, next: number): number {
  assertValidStateWord(prev);
  assertValidStateWord(next);
  return prev ^ next;
}

export function didDimensionChange(prev: number, next: number, dim: StateWordDimension): boolean {
  assertValidStateWord(prev);
  assertValidStateWord(next);
  const bits = STATE_WORD_BITS[dim];
  if (!bits) throw new RangeError(`Unknown state-word dimension: ${String(dim)}`);
  return (((prev ^ next) >>> bits.offset) & bits.mask) !== 0;
}
