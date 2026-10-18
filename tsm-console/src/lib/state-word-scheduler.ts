/**
 * state-word-scheduler.ts — client-side B/D/C/T/S scheduling primitives.
 *
 * The 16-bit packing follows Zhang et al. (2026): B[15:14], D[13:12],
 * C[11:9], T[8:6], S[5:3], and R[2:0]. This module builds state words and
 * produces deterministic target/fetch/release plans. The render-layer caller
 * must still connect these plans to parsed per-feature metadata and I/O.
 */

import {
  assertValidStateWord,
  decodeStateWord,
  didDimensionChange,
  getStateWordExceptionFlag,
  STATE_WORD_BITS,
  STATE_WORD_R_BITS,
  type StateWordDimension,
  type StateWordValues,
} from './tiles-3d-renderer-layer';

/** Under pressure, lower texture, then component complexity, then semantics. */
export const DEGRADATION_ORDER: readonly StateWordDimension[] = ['T', 'C', 'S'];

export interface SchedulerBudget {
  /**
   * Caller-supplied estimate of available GPU memory in MB.
   * This API does not imply that portable hardware VRAM introspection exists.
   */
  vramMB: number;
  /** Current frame rate observed by the caller. */
  fps: number;
  /** FPS below which one degradation step is applied. Default 30. */
  minFps?: number;
  /** Available-memory estimate below which one degradation step is applied. Default 1024 MB. */
  minVramMB?: number;
}

/** Per-feature scheduling record. */
export interface FeatureSchedule {
  objectId: string;
  homeTileId: string;
  currentWord: number;
  targetWord: number;
}

export interface ScheduledTarget {
  objectId: string;
  targetWord: number;
}

export interface ResourcePlan {
  objectId: string;
  dims: StateWordDimension[];
}

export interface FrameSchedule {
  /** Updated desired words, including R's exception flag after degradation. */
  targets: ScheduledTarget[];
  /** Resource dimensions whose target level exceeds the current level. */
  fetch: ResourcePlan[];
  /** Resource dimensions whose target level is below the current level. */
  release: ResourcePlan[];
}

function requireNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
}

function validateBudget(budget: SchedulerBudget): { minFps: number; minVramMB: number } {
  if (!budget || typeof budget !== 'object') throw new TypeError('Scheduler budget is required.');
  for (const [name, value] of [
    ['vramMB', budget.vramMB],
    ['fps', budget.fps],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`Scheduler budget ${name} must be finite and non-negative.`);
    }
  }

  const minFps = budget.minFps ?? 30;
  const minVramMB = budget.minVramMB ?? 1024;
  if (!Number.isFinite(minFps) || minFps < 0) {
    throw new RangeError('minFps must be finite and non-negative.');
  }
  if (!Number.isFinite(minVramMB) || minVramMB < 0) {
    throw new RangeError('minVramMB must be finite and non-negative.');
  }
  return { minFps, minVramMB };
}

/**
 * Degrade one or more levels in T -> C -> S order, skipping dimensions already
 * at level 0. Never degrades B or D. R bit 0 marks an actual constraint-driven
 * degradation; reserved R bits remain zero.
 */
export function degradeWord(word: number, stepsDown: number): number {
  assertValidStateWord(word);
  if (!Number.isInteger(stepsDown) || stepsDown < 0) {
    throw new RangeError('stepsDown must be a non-negative integer.');
  }

  let out = word;
  let applied = 0;
  while (applied < stepsDown) {
    let changed = false;
    for (const dimension of DEGRADATION_ORDER) {
      const currentLevel = decodeStateWord(out, dimension);
      if (currentLevel === 0) continue;

      const { offset, mask } = STATE_WORD_BITS[dimension];
      const fieldMask = mask << offset;
      out = (out & ~fieldMask) | ((currentLevel - 1) << offset);
      applied += 1;
      changed = true;
      break;
    }
    if (!changed) break;
  }

  if (out !== word) out |= STATE_WORD_R_BITS.exceptionFlagMask;
  assertValidStateWord(out);
  return out;
}

/**
 * Determine which dimensions need fetching when their target level increases.
 * R-field changes alone never trigger a dimension fetch.
 */
export function chunksToFetch(prev: number, next: number): StateWordDimension[] {
  assertValidStateWord(prev);
  assertValidStateWord(next);
  return (['B', 'D', 'C', 'T', 'S'] as const).filter(
    (dimension) =>
      didDimensionChange(prev, next, dimension) &&
      decodeStateWord(next, dimension) > decodeStateWord(prev, dimension),
  );
}

/** Determine which dimensions can be released when their level decreases. */
export function chunksToRelease(prev: number, next: number): StateWordDimension[] {
  assertValidStateWord(prev);
  assertValidStateWord(next);
  return (['B', 'D', 'C', 'T', 'S'] as const).filter(
    (dimension) =>
      didDimensionChange(prev, next, dimension) &&
      decodeStateWord(next, dimension) < decodeStateWord(prev, dimension),
  );
}

/**
 * Resolve an already-assigned Home Tile pointer. This helper does not compute
 * a centroid or perform semantic fetches; upstream preprocessing owns assignment.
 */
export function resolveHomeTile(feature: { objectId: string; homeTileId?: string }): string {
  requireNonEmptyString(feature?.objectId, 'objectId');
  if (feature.homeTileId === undefined) return feature.objectId;
  requireNonEmptyString(feature.homeTileId, 'homeTileId');
  return feature.homeTileId;
}

/**
 * Compute one pure scheduling pass. The caller must persist target words and
 * execute the returned resource operations. Pressure comes from either FPS or
 * the caller's available-VRAM estimate; there is no implicit device probe.
 */
export function scheduleFrame(
  features: FeatureSchedule[],
  budget: SchedulerBudget,
): FrameSchedule {
  if (!Array.isArray(features)) throw new TypeError('features must be an array.');
  const { minFps, minVramMB } = validateBudget(budget);
  const underPressure = budget.fps < minFps || budget.vramMB < minVramMB;

  const targets: ScheduledTarget[] = [];
  const fetch: ResourcePlan[] = [];
  const release: ResourcePlan[] = [];

  for (const feature of features) {
    requireNonEmptyString(feature?.objectId, 'feature.objectId');
    requireNonEmptyString(feature?.homeTileId, 'feature.homeTileId');
    assertValidStateWord(feature.currentWord);
    assertValidStateWord(feature.targetWord);

    const targetWord = underPressure ? degradeWord(feature.targetWord, 1) : feature.targetWord;
    targets.push({ objectId: feature.objectId, targetWord });

    const toFetch = chunksToFetch(feature.currentWord, targetWord);
    const toRelease = chunksToRelease(feature.currentWord, targetWord);
    if (toFetch.length > 0) fetch.push({ objectId: feature.objectId, dims: toFetch });
    if (toRelease.length > 0) release.push({ objectId: feature.objectId, dims: toRelease });
  }

  return { targets, fetch, release };
}

export { DEGRADATION_ORDER as STATE_WORD_DEGRADATION_ORDER, getStateWordExceptionFlag };
export type { StateWordValues };
