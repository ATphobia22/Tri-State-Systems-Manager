import type { RiverGaugeObservation } from '../lib/river-gauges';

/**
 * useLiveGauges — RETIRED.
 *
 * Live river data was dropped by owner decision on 2026-09-29
 * ("drop login and live river data"). This hook no longer polls anything;
 * it returns the retired empty state so existing call sites degrade
 * gracefully instead of breaking. The shape is preserved for
 * source compatibility.
 */
export function useLiveGauges(_intervalMs = 60_000): {
  gauges: RiverGaugeObservation[];
  loading: boolean;
  lastUpdated: string | null;
} {
  return { gauges: [], loading: false, lastUpdated: null };
}
