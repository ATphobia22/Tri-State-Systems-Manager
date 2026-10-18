/**
 * state-word-scheduler.ts — client-side 5D state-word scheduler.
 *
 * Research basis: "A 5D Orthogonal Decoupling Framework and 16-Bit State-Word"
 * (ISPRS IJGI 2026, 15, 215). This module supplies tested codec and pure
 * scheduling primitives; it does not itself perform network or GPU operations:
 *
 * - F = B x D x C x T x S, packed in the published 16-bit layout:
 *     B (boundary proxy) : bits 14-15 (2 bits)
 *     D (geometric detail): bits 12-13 (2 bits)
 *     C (component complexity): bits 9-11 (3 bits)
 *     T (texture appearance): bits 6-8 (3 bits)
 *     S (semantic depth)  : bits 3-5 (3 bits)
 *     R (reserved/exception extension): bits 0-2 (3 bits)
 * - O(1) bitwise decode (no library needed; GLSL ES 3.00 / WGSL both support it)
 * - XOR-diff incremental updates: only fetch chunks whose dimensions changed
 * - Constraint-aware degradation: drop T/C/S before D under memory pressure
 * - Home Tile helper resolves a provided homeTileId or falls back to objectId.
 *   The full metadata schema, tile-carrier mapping and resource fetch pipeline
 *   remain separate integration work; no paper benchmark is claimed for TSM.
 */

import { assertValidStateWord, decodeStateWord, didDimensionChange, STATE_WORD_BITS, type StateWordDimension } from './state-word-codec';

/** Degradation order under memory pressure: strip T, then C, then S; keep D. */
const DEGRADATION_ORDER: StateWordDimension[] = ['T', 'C', 'S'];

export interface SchedulerBudget {
  /** Available GPU memory in MB, if exposed by a supported telemetry source. */
  vramMB?: number;
  /** Current frame rate. Below threshold triggers degradation. */
  fps: number;
  /** FPS below which we degrade. Default 30. */
  minFps?: number;
  /** Optional low-memory threshold in MB; omitted when VRAM telemetry is unavailable. */
  minVramMB?: number;
}

function validateBudget(budget: SchedulerBudget): void {
  for (const [name, value] of [["vramMB", budget.vramMB], ["fps", budget.fps]] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new RangeError(`${name} must be a finite non-negative number when provided`);
    }
  }
  if (budget.fps === undefined) {
    throw new RangeError("fps must be provided as a finite non-negative number");
  }
  for (const [name, value] of [["minFps", budget.minFps], ["minVramMB", budget.minVramMB]] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new RangeError(`${name} must be a finite non-negative number when provided`);
    }
  }
}

/** Per-feature scheduling record. */
export interface FeatureSchedule {
  objectId: string;
  homeTileId: string;
  currentWord: number;
  targetWord: number;
}

/**
 * Compute the degraded target word for a feature under budget pressure.
 * Drops texture, then components, then semantics — never geometric detail.
 */
export function degradeWord(word: number, stepsDown: number): number {
  assertValidStateWord(word);
  if (!Number.isInteger(stepsDown) || stepsDown < 0) {
    throw new RangeError("stepsDown must be a non-negative integer");
  }
  let out = word;
  // Bit layout (must match tiles-3d-renderer-layer.ts):
  // Exhaust each dimension in priority order before reducing the next one.
  const dims = DEGRADATION_ORDER.map((dimension) => STATE_WORD_BITS[dimension]);
  for (let step = 0; step < stepsDown; step++) {
    const reducible = dims.find(({ offset, mask }) => ((out >>> offset) & mask) > 0);
    if (!reducible) break;
    const current = (out >>> reducible.offset) & reducible.mask;
    out = (out & ~(reducible.mask << reducible.offset)) |
      ((current - 1) << reducible.offset);
  }
  return out;
}

/**
 * Decide which resource chunks to fetch for a feature given its state words.
 * Returns the dimensions whose level increased (need fetch) — XOR-diff based.
 */
export function chunksToFetch(prev: number, next: number): StateWordDimension[] {
  const dims: StateWordDimension[] = ['B', 'D', 'C', 'T', 'S'];
  return dims.filter(
    (d) => didDimensionChange(prev, next, d) && decodeStateWord(next, d) > decodeStateWord(prev, d),
  );
}

/**
 * Decide which resource chunks can be released (level decreased).
 */
export function chunksToRelease(prev: number, next: number): StateWordDimension[] {
  const dims: StateWordDimension[] = ['B', 'D', 'C', 'T', 'S'];
  return dims.filter(
    (d) => didDimensionChange(prev, next, d) && decodeStateWord(next, d) < decodeStateWord(prev, d),
  );
}

/**
 * Home-Tile semantic routing: resolve where full semantics live.
 * Guest tiles carry only { objectId, homeTileId, uri } pointers.
 */
export function resolveHomeTile(feature: { objectId: string; homeTileId?: string }): string {
  return feature.homeTileId ?? feature.objectId;
}

/**
 * One scheduling pass over visible features. Returns fetch/release plans.
 * Pure function — the caller performs the actual network/GPU work.
 */
export function scheduleFrame(
  features: FeatureSchedule[],
  budget: SchedulerBudget,
): { fetch: Array<{ objectId: string; dims: StateWordDimension[] }>; release: Array<{ objectId: string; dims: StateWordDimension[] }> } {
  validateBudget(budget);
  const minFps = budget.minFps ?? 30;
  const underFpsPressure = budget.fps < minFps;
  const underMemoryPressure =
    budget.minVramMB !== undefined &&
    budget.vramMB !== undefined &&
    budget.vramMB < budget.minVramMB;
  const underPressure = underFpsPressure || underMemoryPressure;

  const fetch: Array<{ objectId: string; dims: StateWordDimension[] }> = [];
  const release: Array<{ objectId: string; dims: StateWordDimension[] }> = [];

  for (const f of features) {
    const target = underPressure ? degradeWord(f.targetWord, 1) : f.targetWord;
    const toFetch = chunksToFetch(f.currentWord, target);
    const toRelease = chunksToRelease(f.currentWord, target);
    if (toFetch.length > 0) fetch.push({ objectId: f.objectId, dims: toFetch });
    if (toRelease.length > 0) release.push({ objectId: f.objectId, dims: toRelease });
  }

  return { fetch, release };
}

export { DEGRADATION_ORDER };
