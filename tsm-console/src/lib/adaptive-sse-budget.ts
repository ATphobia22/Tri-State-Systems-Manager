/**
 * Frame-budget controller for the existing 3D Tiles SSE refinement pipeline.
 *
 * Higher SSE means less refinement and lower CPU/GPU pressure; lower SSE means
 * more detail. This does not implement or pretend to implement GPU culling.
 * The 3D Tiles renderer continues to own hierarchical traversal and frustum tests.
 */
export interface AdaptiveSseBudgetOptions {
  baseSse: number;
  minFps: number;
  recoveryFps: number;
  minSse?: number;
  maxSse?: number;
  adjustmentFactor?: number;
}

export class AdaptiveSseBudget {
  private readonly baseSse: number;
  private readonly minFps: number;
  private readonly recoveryFps: number;
  private readonly minSse: number;
  private readonly maxSse: number;
  private readonly adjustmentFactor: number;
  private currentSse: number;

  constructor(options: AdaptiveSseBudgetOptions) {
    const minSse = options.minSse ?? options.baseSse / 2;
    const maxSse = options.maxSse ?? options.baseSse * 4;
    const adjustmentFactor = options.adjustmentFactor ?? 1.25;
    if (![options.baseSse, options.minFps, options.recoveryFps, minSse, maxSse, adjustmentFactor].every(Number.isFinite) ||
        options.baseSse <= 0 || options.minFps <= 0 || options.recoveryFps < options.minFps ||
        minSse <= 0 || maxSse < options.baseSse || minSse > options.baseSse ||
        adjustmentFactor <= 1) {
      throw new RangeError('Invalid adaptive SSE budget configuration');
    }
    this.baseSse = options.baseSse;
    this.minFps = options.minFps;
    this.recoveryFps = options.recoveryFps;
    this.minSse = minSse;
    this.maxSse = maxSse;
    this.adjustmentFactor = adjustmentFactor;
    this.currentSse = options.baseSse;
  }

  get value(): number {
    return this.currentSse;
  }

  update(fps: number | null): number {
    if (fps === null || !Number.isFinite(fps) || fps < 0) return this.currentSse;
    if (fps < this.minFps) {
      this.currentSse = Math.min(this.maxSse, this.currentSse * this.adjustmentFactor);
    } else if (fps > this.recoveryFps) {
      this.currentSse = Math.max(this.minSse, this.currentSse / this.adjustmentFactor);
    }
    return this.currentSse;
  }

  reset(): void {
    this.currentSse = this.baseSse;
  }
}
