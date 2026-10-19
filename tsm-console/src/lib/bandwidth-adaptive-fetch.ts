/**
 * Bandwidth-adaptive fetch controller — closes the adaptive streaming gap
 * for C/S state transitions by measuring throughput and adjusting concurrency.
 *
 * Works with TileResourceLifecycle + TilesFetchBridge. Does not invent tiles.
 */

export interface ThroughputSample {
  bytes: number;
  durationMs: number;
  at: number;
}

export interface AdaptiveFetchConfig {
  /** Rolling window size for samples */
  windowSize: number;
  /** Target bytes/sec; below this we shed concurrency */
  minBytesPerSec: number;
  /** Above this we may raise concurrency */
  maxBytesPerSec: number;
  minConcurrency: number;
  maxConcurrency: number;
}

const DEFAULT_CONFIG: AdaptiveFetchConfig = {
  windowSize: 8,
  minBytesPerSec: 50_000,
  maxBytesPerSec: 2_000_000,
  minConcurrency: 1,
  maxConcurrency: 12,
};

export class BandwidthAdaptiveFetchController {
  private readonly samples: ThroughputSample[] = [];
  private concurrency: number;
  private readonly config: AdaptiveFetchConfig;

  constructor(config: Partial<AdaptiveFetchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.concurrency = Math.min(
      this.config.maxConcurrency,
      Math.max(this.config.minConcurrency, 4),
    );
  }

  /** Record a completed fetch. */
  recordSample(bytes: number, durationMs: number, at = Date.now()): void {
    if (!Number.isFinite(bytes) || bytes < 0) return;
    if (!Number.isFinite(durationMs) || durationMs <= 0) return;
    this.samples.push({ bytes, durationMs, at });
    while (this.samples.length > this.config.windowSize) this.samples.shift();
    this.recompute();
  }

  getConcurrency(): number {
    return this.concurrency;
  }

  /** Estimated bytes/sec over the rolling window; 0 if no samples. */
  getBytesPerSec(): number {
    if (this.samples.length === 0) return 0;
    const bytes = this.samples.reduce((s, x) => s + x.bytes, 0);
    const ms = this.samples.reduce((s, x) => s + x.durationMs, 0);
    if (ms <= 0) return 0;
    return (bytes * 1000) / ms;
  }

  /** Suggested degrade steps when throughput is poor (0 = none). */
  suggestedDegradeSteps(): number {
    const bps = this.getBytesPerSec();
    if (this.samples.length < 2) return 0;
    if (bps < this.config.minBytesPerSec * 0.25) return 2;
    if (bps < this.config.minBytesPerSec) return 1;
    return 0;
  }

  private recompute(): void {
    const bps = this.getBytesPerSec();
    if (this.samples.length < 2) return;
    if (bps < this.config.minBytesPerSec) {
      this.concurrency = Math.max(this.config.minConcurrency, this.concurrency - 1);
    } else if (bps > this.config.maxBytesPerSec) {
      this.concurrency = Math.min(this.config.maxConcurrency, this.concurrency + 1);
    }
  }
}
