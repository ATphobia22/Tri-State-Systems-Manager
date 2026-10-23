/**
 * Reproducible browser-side terrain frame benchmark collector.
 *
 * This collects CPU-observable frame timings. It does not claim GPU timing or
 * GPU memory usage unless the host supplies separately measured values.
 */
export interface TerrainBenchmarkOptions {
  label: string;
  warmupFrames?: number;
  measuredFrames?: number;
  frame: (index: number) => void | Promise<void>;
  device?: GPUDevice;
  viewport?: { width: number; height: number; devicePixelRatio: number };
  getRendererBytes?: () => number | null;
}

export interface TerrainBenchmarkReport {
  schemaVersion: 1;
  label: string;
  capturedAt: string;
  userAgent: string | null;
  viewport: { width: number; height: number; devicePixelRatio: number } | null;
  frameCount: number;
  warmupFrames: number;
  frameTimeMs: { p50: number; p95: number; p99: number; min: number; max: number; mean: number };
  jsHeapBytes: number | null;
  rendererResourceBytes: number | null;
  gpu: {
    deviceAvailable: boolean;
    features: string[];
    limits: Record<string, number> | null;
    timing: 'not-measured';
    memory: 'not-measured';
  };
  warnings: string[];
}

function percentile(sorted: readonly number[], quantile: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(quantile * sorted.length) - 1));
  return sorted[index]!;
}

function summarize(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / Math.max(1, sorted.length);
  return {
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    mean,
  };
}

export async function runTerrainFrameBenchmark(options: TerrainBenchmarkOptions): Promise<TerrainBenchmarkReport> {
  const warmupFrames = options.warmupFrames ?? 30;
  const measuredFrames = options.measuredFrames ?? 300;
  if (!Number.isInteger(warmupFrames) || warmupFrames < 0) throw new RangeError('warmupFrames must be integer >= 0');
  if (!Number.isInteger(measuredFrames) || measuredFrames < 1) throw new RangeError('measuredFrames must be integer >= 1');
  if (!options.label.trim()) throw new RangeError('label is required');

  for (let i = 0; i < warmupFrames; i++) await options.frame(i);
  const samples: number[] = [];
  for (let i = 0; i < measuredFrames; i++) {
    const start = performance.now();
    await options.frame(warmupFrames + i);
    samples.push(performance.now() - start);
  }

  const performanceWithMemory = performance as Performance & { memory?: { usedJSHeapSize?: number } };
  const limits = options.device ? {
    maxBufferSize: options.device.limits.maxBufferSize,
    maxStorageBufferBindingSize: options.device.limits.maxStorageBufferBindingSize,
    maxTextureDimension2D: options.device.limits.maxTextureDimension2D,
    maxTextureDimension3D: options.device.limits.maxTextureDimension3D,
    maxComputeWorkgroupsPerDimension: options.device.limits.maxComputeWorkgroupsPerDimension,
  } : null;
  const warnings: string[] = [
    'Frame samples measure wall-clock callback duration, not GPU execution time.',
    'WebGPU device memory usage is not exposed by this report; rendererResourceBytes is host-reported.',
  ];
  if (!options.device) warnings.push('No GPUDevice was supplied; GPU feature/limit data is unavailable.');

  return {
    schemaVersion: 1,
    label: options.label,
    capturedAt: new Date().toISOString(),
    userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
    viewport: options.viewport ?? null,
    frameCount: samples.length,
    warmupFrames,
    frameTimeMs: summarize(samples),
    jsHeapBytes: performanceWithMemory.memory?.usedJSHeapSize ?? null,
    rendererResourceBytes: options.getRendererBytes?.() ?? null,
    gpu: {
      deviceAvailable: Boolean(options.device),
      features: options.device ? [...options.device.features] : [],
      limits,
      timing: 'not-measured',
      memory: 'not-measured',
    },
    warnings,
  };
}
