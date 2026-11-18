/**
 * Explicit button-only USGS Water Data OGC v1 fallback for the public map.
 *
 * The standard server-side hydrology adapter remains preferred. This adapter
 * is used only when an operator requests observations and that adapter is
 * unavailable; never from a loader, polling loop, or automated simulation.
 * No water-surface NAVD88 calculation or source identity substitution.
 */
import { fetchUsgsLatestContinuous, type UsgsDirectObservation } from './usgs-direct.ts';
import { GAGE_DATUM_TABLE } from './gage-datums.ts';
import type { StationLiveSnapshot } from './multi-stage-fetch';

const MAX_CURRENT_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const USGS_STAGE_UNIT = 'ft';
const USGS_CFS_UNITS = new Set(['ft^3/s', 'ft3/s', 'ft³/s']);

function chooseLatest(
  observations: UsgsDirectObservation[],
  parameter: string,
  acceptedUnit: (unit: string) => boolean,
  now: number,
): UsgsDirectObservation | undefined {
  return observations
    .filter((o) => o.parameterCode === parameter && typeof o.unit === 'string' &&
      acceptedUnit(o.unit) && Number.isFinite(Date.parse(o.observedAt)) &&
      Date.parse(o.observedAt) <= now + MAX_FUTURE_SKEW_MS)
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];
}

function unavailable(stationId: string, message: string): StationLiveSnapshot {
  const metadata = GAGE_DATUM_TABLE[stationId];
  return {
    stationId, name: metadata?.name ?? `USGS ${stationId}`,
    lat: metadata?.lat ?? 0, lon: metadata?.lon ?? 0,
    stage_ft: null, discharge_cfs: null, observedAt: null,
    retrievedAt: new Date().toISOString(), status: 'unavailable',
    qualifier: null, vertical_reference: 'GAGE_DATUM', wse_navd88_ft: null,
    conversion_applied: false, sourceUri: null, error: message.slice(0, 240),
  };
}

/**
 * Uses verified station IDs from the shared datum table; no silent enumeration.
 * The fetcher argument is for isolated tests, never a way to loosen validation.
 */
export async function fetchUsgsConstellation(
  stationIds: readonly string[],
  fetcher: typeof fetch = fetch,
): Promise<StationLiveSnapshot[]> {
  return Promise.all(stationIds.map(async (stationId) => {
    const metadata = GAGE_DATUM_TABLE[stationId];
    if (!metadata?.usgsId || metadata.usgsId !== stationId) {
      return unavailable(stationId, 'No reviewed USGS station identity available.');
    }

    try {
      const observations = await fetchUsgsLatestContinuous(stationId, ['00065', '00060'], {
        fetcher, timeoutMs: 8000,
      });
      const now = Date.now();
      const stage = chooseLatest(observations, '00065', (u) => u === USGS_STAGE_UNIT, now);
      if (!stage) return unavailable(stationId, 'No station-matched gage-height observation in feet.');
      const discharge = chooseLatest(observations, '00060', (u) => USGS_CFS_UNITS.has(u), now);
      const age = now - Date.parse(stage.observedAt);
      const provisional = stage.approvalStatus?.toLowerCase() !== 'approved' &&
        stage.approvalStatus?.toLowerCase() !== 'final';
      const status: StationLiveSnapshot['status'] = age > MAX_CURRENT_AGE_MS ? 'stale' :
        provisional ? 'provisional' : 'current';
      return {
        stationId, name: metadata.name, lat: metadata.lat, lon: metadata.lon,
        stage_ft: stage.value, discharge_cfs: discharge?.value ?? null,
        observedAt: stage.observedAt, retrievedAt: stage.retrievedAt, status,
        qualifier: provisional ? 'Provisional / not final' : null,
        vertical_reference: 'GAGE_DATUM', wse_navd88_ft: null,
        conversion_applied: false, sourceUri: stage.sourceUri, error: null,
      };
    } catch (error) {
      return unavailable(stationId, error instanceof Error
        ? `Official USGS Water Data unavailable: ${error.message}`
        : 'Official USGS Water Data unavailable.');
    }
  }));
}
