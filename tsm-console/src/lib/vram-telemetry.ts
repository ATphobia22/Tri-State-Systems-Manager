/**
 * TSM VRAM Telemetry & State-Word Degradation
 *
 * Monitors GPU memory pressure and network bandwidth, automatically
 * degrading 16-bit state-words to shed load without dropping core geometry.
 *
 * Degradation policy (from blueprint):
 * - VRAM > 85%: Drop T (texture) to T_1, strip C (components) to C_0
 * - Bandwidth < 10 Mbps: Limit S (semantic depth) to S_1
 * - Core geometry (D) is NEVER degraded — only visual/semantic fidelity
 */

import { decodeStateWord, encodeStateWord, StateWordValues } from './state-word-codec';

export interface TelemetrySnapshot {
  /** GPU VRAM usage ratio (0.0 - 1.0), null if unavailable */
  vramUsageRatio: number | null;
  /** Network bandwidth in Mbps, null if unavailable */
  bandwidthMbps: number | null;
  /** Timestamp of snapshot */
  timestamp: number;
}

export interface DegradationResult {
  originalWord: number;
  degradedWord: number;
  degraded: boolean;
  reasons: string[];
}

/**
 * Get current VRAM usage ratio via WebGPU adapter info.
 * Returns null if WebGPU is unavailable or doesn't expose memory info.
 */
export async function getVramUsage(): Promise<number | null> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return null;
  }
  try {
    const adapter = await (navigator as any).gpu.requestAdapter();
    if (!adapter) return null;
    // Note: WebGPU doesn't yet expose VRAM usage directly.
    // This is a placeholder for when the API adds memory reporting.
    // For now, we estimate via performance.memory (Chrome only).
    const perf = (performance as any).memory;
    if (perf && perf.usedJSHeapSize && perf.jsHeapSizeLimit) {
      // Use JS heap as a rough proxy for memory pressure
      return perf.usedJSHeapSize / perf.jsHeapSizeLimit;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Estimate network bandwidth via the Network Information API.
 * Returns null if unavailable.
 */
export function getBandwidthEstimate(): number | null {
  const conn = (navigator as any).connection;
  if (!conn || typeof conn.downlink !== 'number') {
    return null;
  }
  return conn.downlink; // Mbps
}

/**
 * Capture a full telemetry snapshot.
 */
export async function captureTelemetry(): Promise<TelemetrySnapshot> {
  const [vramUsageRatio, bandwidthMbps] = await Promise.all([
    getVramUsage(),
    Promise.resolve(getBandwidthEstimate()),
  ]);
  return {
    vramUsageRatio,
    bandwidthMbps,
    timestamp: Date.now(),
  };
}

/**
 * Evaluate whether a state-word should be degraded based on telemetry.
 * Returns the (possibly degraded) state-word and reasons.
 *
 * Degradation rules:
 * 1. VRAM > 85%: T → min(T, 1), C → 0 (strip PBR, remove sub-components)
 * 2. Bandwidth < 10 Mbps: S → min(S, 1) (limit semantic payload)
 * 3. D (geometry) is NEVER touched — core spatial data is sacred
 */
export function evaluateDegradation(
  stateWord: number,
  telemetry: TelemetrySnapshot
): DegradationResult {
  const state: StateWordValues = {
    B: decodeStateWord(stateWord, 'B'),
    D: decodeStateWord(stateWord, 'D'),
    C: decodeStateWord(stateWord, 'C'),
    T: decodeStateWord(stateWord, 'T'),
    S: decodeStateWord(stateWord, 'S'),
  };
  const reasons: string[] = [];
  let degraded = false;

  // Rule 1: VRAM pressure — shed texture and component complexity
  if (telemetry.vramUsageRatio !== null && telemetry.vramUsageRatio > 0.85) {
    if (state.T > 1) {
      state.T = 1;
      degraded = true;
      reasons.push(`VRAM ${(telemetry.vramUsageRatio * 100).toFixed(0)}% > 85%: T→1 (procedural color)`);
    }
    if (state.C > 0) {
      state.C = 0;
      degraded = true;
      reasons.push(`VRAM pressure: C→0 (strip sub-components)`);
    }
  }

  // Rule 2: Bandwidth congestion — limit semantic payload
  if (telemetry.bandwidthMbps !== null && telemetry.bandwidthMbps < 10.0) {
    if (state.S > 1) {
      state.S = 1;
      degraded = true;
      reasons.push(`Bandwidth ${telemetry.bandwidthMbps.toFixed(1)} Mbps < 10: S→1 (basic semantics)`);
    }
  }

  return {
    originalWord: stateWord,
    degradedWord: degraded ? encodeStateWord(state) : stateWord,
    degraded,
    reasons,
  };
}

/**
 * Telemetry monitor that periodically checks conditions and calls back
 * when degradation thresholds are crossed.
 */
export class VramTelemetryMonitor {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastDegraded = false;

  constructor(
    private checkIntervalMs = 5000,
    private onDegradationChange?: (degraded: boolean, telemetry: TelemetrySnapshot) => void
  ) {}

  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(async () => {
      const telemetry = await captureTelemetry();
      const isDegraded =
        (telemetry.vramUsageRatio !== null && telemetry.vramUsageRatio > 0.85) ||
        (telemetry.bandwidthMbps !== null && telemetry.bandwidthMbps < 10.0);

      if (isDegraded !== this.lastDegraded) {
        this.lastDegraded = isDegraded;
        this.onDegradationChange?.(isDegraded, telemetry);
      }
    }, this.checkIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
