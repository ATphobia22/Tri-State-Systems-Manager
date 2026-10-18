/**
 * state-word-scheduler.ts — client-side 5D state-word scheduler.
 *
 * Research basis: "A 5D Orthogonal Decoupling Framework and 16-Bit State-Word"
 * (ISPRS IJGI 2026, 15, 215). No open-source implementation exists; this is a
 * clean-room client-side scheduler implementing the paper's core mechanics:
 *
 * - F = B x D x C x T x S, packed into a 16-bit word:
 *     B (boundary proxy) : bits 0-2
 *     D (geometric detail): bits 3-5
 *     C (component complexity): bits 6-8
 *     T (texture appearance): bits 9-12
 *     S (semantic depth)  : bits 13-15
 * - O(1) bitwise decode (no library needed; GLSL ES 3.00 / WGSL both support it)
 * - XOR-diff incremental updates: only fetch chunks whose dimensions changed
 * - Constraint-aware degradation: drop T/C/S before D under memory pressure
 * - Home Tile routing: full semantics live in the centroid tile; guest tiles
 *   carry { objectId, homeTileId, uri } pointers (44.1% semantic payload cut)
 *
 * The word is carried per-feature via 3D Tiles 1.1 EXT_structural_metadata
 * (uint16 property, zero schema changes). Tiles do spatial selection; the
 * state word drives object-level resource scheduling afterwards.
 */

import { decodeStateWord, didDimensionChange, type StateWordDimension } from './tiles-3d-renderer-layer';

/** Degradation order under memory pressure: strip T, then C, then S; keep D. */
const DEGRADATION_ORDER: StateWordDimension[] = ['T', 'C', 'S'];

export interface SchedulerBudget {
  /** Available GPU memory in MB, as reported by a supported telemetry source. */
  vramMB: number;
  /** Current frame rate. Below threshold triggers degradation. */
  fps: number;
  /** FPS below which we degrade. Default 30. */
  minFps?: number;
  /** Optional low-memory threshold in MB; omitted when VRAM telemetry is unavailable. */
  minVramMB?: number;
}

function validateBudget(budget: SchedulerBudget): void {
  for (const [name, value] of [["vramMB", budget.vramMB], ["fps", budget.fps]] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${name} must be a finite non-negative number`);
    }
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
  if (!Number.isInteger(word) || word < 0 || word > 0xffff) {
    throw new RangeError("word must be an unsigned 16-bit integer");
  }
  if (!Number.isInteger(stepsDown) || stepsDown < 0) {
    throw new RangeError("stepsDown must be a non-negative integer");
  }
  let out = word;
  // Bit layout (must match tiles-3d-renderer-layer.ts):
  // B:0-2 D:3-5 C:6-8 T:9-12 S:13-15
  const dims: Array<{ offset: number; mask: number; levels: number }> = [
    { offset: 9, mask: 0xf, levels: 4 },  // T
    { offset: 6, mask: 0x7, levels: 3 },  // C
    { offset: 13, mask: 0x7, levels: 3 }, // S
  ];
  for (let s = 0; s < stepsDown; s++) {
    const d = dims[s % dims.length];
    const cur = (out >> d.offset) & d.mask;
    if (cur > 0) {
      out = (out & ~(d.mask << d.offset)) | ((cur - 1) << d.offset);
    }
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
    budget.minVramMB !== undefined && budget.vramMB < budget.minVramMB;
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
