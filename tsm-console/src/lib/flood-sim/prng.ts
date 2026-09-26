/**
 * prng.ts — mulberry32 seeded pseudo-random number generator.
 *
 * mulberry32 is a small, fast, well-tested 32-bit PRNG with a period of
 * 2^32. It is NOT cryptographically secure and must never be used for
 * secrets, tokens, or anything security-sensitive. In the flood simulator it
 * serves exactly two purposes:
 *
 *   1. Deterministic procedural terrain refinement (world/terrain.ts): the
 *      same seed always produces the same noise field, so a scenario's
 *      terrain is reproducible.
 *   2. Seeding the simulation engine (engine.ts): any stochastic element of
 *      a run (currently: none in the physics core; reserved for future
 *      ensemble perturbation) derives from this stream so that two runs
 *      with the same seed + inputs are bit-identical.
 *
 * Determinism note: mulberry32 state transitions are pure integer
 * arithmetic on 32-bit words; results are identical across JS engines.
 */

/** Opaque handle for a mulberry32 generator instance. */
export interface Mulberry32 {
  /** Next pseudo-random float in [0, 1). */
  next(): number;
  /** Next pseudo-random 32-bit unsigned integer. */
  nextUint32(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max] (inclusive). */
  intRange(min: number, max: number): number;
  /** Current internal state (for save/restore). */
  getState(): number;
  /** Restore a previously saved state. */
  setState(state: number): void;
}

/**
 * Create a mulberry32 generator seeded with a 32-bit unsigned integer.
 * Non-integer seeds are truncated; the seed is mixed so that seed 0 does
 * not produce a degenerate stream.
 */
export function mulberry32(seed: number): Mulberry32 {
  let state = (seed >>> 0) || 0x9e3779b9;

  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };

  return {
    next(): number {
      // 2^-32 scaling maps the full uint32 range onto [0, 1).
      return nextUint32() / 4294967296;
    },
    nextUint32,
    range(min: number, max: number): number {
      if (!(min < max)) {
        throw new Error(`prng.range requires min < max (got ${min}, ${max})`);
      }
      return min + (max - min) * (nextUint32() / 4294967296);
    },
    intRange(min: number, max: number): number {
      if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
        throw new Error(`prng.intRange requires integer min <= max (got ${min}, ${max})`);
      }
      return min + (nextUint32() % (max - min + 1));
    },
    getState(): number {
      return state >>> 0;
    },
    setState(nextState: number): void {
      if (!Number.isInteger(nextState) || nextState < 0 || nextState > 0xffffffff) {
        throw new Error(`prng.setState requires a uint32 (got ${nextState})`);
      }
      state = nextState >>> 0;
    },
  };
}

/**
 * Derive a uint32 seed from an arbitrary string (FNV-1a 32-bit). Used to
 * turn human-readable scenario ids (e.g. "1937-ohio-river-flood") into
 * deterministic numeric seeds.
 */
export function seedFromString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
