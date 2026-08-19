/**
 * Live NOAA / USGS stage fetch with graceful fallback
 * Primary: NOAA water.weather.gov / water.noaa.gov for MTVI3
 * Fallback: USGS NWIS instantaneous values
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

  // USGS NWIS instantaneous (03378500 Wabash at New Harmony as regional proxy)
  try {
    const usgsId = '03378500';
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
    // fall through
  }

  return {
    source: 'MOCK',
    gaugeId: SITE.noaaGauge.nwsId,
    value_ft: null,
    timestamp: null,
    floodCategory: 'unknown',
  };
}
