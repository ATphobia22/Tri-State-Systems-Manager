/**
 * Live NOAA / USGS stage fetch with graceful fallback
 * MOCK results are SIMULATION_DEMO — not engineering predictions.
 * Observed vs forecast must never be collapsed.
 */


import { SITE } from '../types/site';
import type { MapTwinLoaderData } from '../types/loaders';

function categorize(ft: number | null): MapTwinLoaderData['stage']['floodCategory'] {
  if (ft == null) return 'unknown';
  const s = SITE.noaaGauge.stages;
  if (ft >= s.major) return 'major';
  if (ft >= s.moderate) return 'moderate';
  if (ft >= s.minor) return 'minor';
  if (ft >= s.action) return 'action';
  return 'normal';
}

/**
 * Attempt live stage. Returns mock/unknown on network failure so the UI never breaks.
 */
export async function fetchLiveStage(): Promise<MapTwinLoaderData['stage']> {
  // NOAA AHPS / water.noaa.gov observed data (best-effort)
  try {
    // Public observed data endpoint pattern (may change; treat as best-effort)
    const url = `https://api.water.noaa.gov/nwps/v1/gauges/${SITE.noaaGauge.nwsId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const json = await res.json();
      const obs = json?.status?.observed?.primary;
      const value = typeof obs === 'number' ? obs : parseFloat(obs);
      if (!Number.isNaN(value)) {
        return {
          source: 'NOAA',
          gaugeId: SITE.noaaGauge.nwsId,
          value_ft: value,
          timestamp: json?.status?.observed?.primaryTime || new Date().toISOString(),
          floodCategory: categorize(value),
        };
      }
    }
  } catch {
    // fall through
  }

  // USGS NWIS instantaneous — 03378500 Wabash New Harmony, then 03322000 Ohio Evansville (corrected)
  for (const usgsId of ['03378500', '03322000'] as const) {
    try {
      const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${usgsId}&parameterCd=00065&siteStatus=all`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const json = await res.json();
        const v = json?.value?.timeSeries?.[0]?.values?.[0]?.value?.[0];
        const value = v ? parseFloat(v.value) : NaN;
        if (!Number.isNaN(value)) {
          return {
            source: 'USGS',
            gaugeId: usgsId,
            value_ft: value,
            timestamp: v.dateTime || new Date().toISOString(),
            floodCategory: categorize(value),
          };
        }
      }
    } catch {
      // try next
    }
  }

  return {
    source: 'MOCK',
    gaugeId: SITE.noaaGauge.nwsId,
    value_ft: null,
    timestamp: null,
    floodCategory: 'unknown',
    // SIMULATION_DEMO — not live telemetry
  };
}
