/**
 * Scope C — multi-station on-demand water levels (button-only).
 * No polling. No auto-fetch on load. Fail-closed per station.
 * All provider requests pass through the TSM server-side hydrology adapter.
 */

import { tsmApiUrl } from './api-base';
import { GAGE_DATUM_TABLE } from './gage-datums';

export type StationLiveSnapshot = {
  stationId: string;
  name: string;
  lat: number;
  lon: number;
  stage_ft: number | null;
  discharge_cfs: number | null;
  observedAt: string | null;
  retrievedAt: string;
  status: 'current' | 'provisional' | 'stale' | 'unavailable';
  qualifier: string | null;
  vertical_reference: 'GAGE_DATUM';
  wse_navd88_ft: number | null;
  conversion_applied: boolean;
  sourceUri: string | null;
  error: string | null;
};

interface HydrologyObservation {
  stationId: string;
  provider?: string;
  value: number | null;
  unit: string | null;
  observedAt: string | null;
  retrievedAt: string | null;
  qualifier: string | null;
  provisional: boolean;
  status: string;
  dischargeCfs: number | null;
  dischargeObservedAt: string | null;
  sourceUri: string | null;
  verticalDatum: string;
  error?: string | null;
}

interface HydrologySnapshotPayload {
  generatedAt?: string;
  observations?: HydrologyObservation[];
}

/** Primary + local Tri-State constellation for button-fetch. */
export const LIVE_FETCH_STATIONS = [
  '03378500', // Wabash @ New Harmony (primary)
  '03322000', // Ohio @ Evansville
  '03322420', // Ohio @ Uniontown / J.T. Myers context
] as const;

async function fetchSnapshotPayload(stationIds: readonly string[], timeoutMs = 12000): Promise<HydrologySnapshotPayload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = tsmApiUrl(`/api/hydrologic/community?stationIds=${encodeURIComponent(stationIds.join(','))}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`TSM hydrology API returned HTTP ${response.status}`);
    const payload = await response.json() as HydrologySnapshotPayload;
    if (!Array.isArray(payload.observations)) throw new Error('TSM hydrology API returned no observations array');
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function toStationSnapshot(stationId: string, observation: HydrologyObservation | undefined): StationLiveSnapshot {
  const retrievedAt = observation?.retrievedAt || new Date().toISOString();
  const meta = GAGE_DATUM_TABLE[stationId];
  const base: StationLiveSnapshot = {
    stationId,
    name: meta?.name ?? `USGS ${stationId}`,
    lat: meta?.lat ?? 0,
    lon: meta?.lon ?? 0,
    stage_ft: null,
    discharge_cfs: null,
    observedAt: null,
    retrievedAt,
    status: 'unavailable',
    qualifier: null,
    vertical_reference: 'GAGE_DATUM',
    wse_navd88_ft: null,
    conversion_applied: false,
    sourceUri: observation?.sourceUri ?? null,
    error: observation?.error ?? null,
  };

  if (!observation || observation.status === 'unavailable' || typeof observation.value !== 'number') {
    return { ...base, error: base.error || 'No usable stage observation returned.' };
  }

  const stageFt = observation.value;
  const provisional = observation.provisional === true;
  const status: StationLiveSnapshot['status'] =
    observation.status === 'stale' ? 'stale' : provisional ? 'provisional' : 'current';
  const gageZero = meta?.conversionPublished === true ? meta.gageZeroNavd88Ft : null;
  const wse = gageZero != null ? stageFt + gageZero : null;

  return {
    ...base,
    stage_ft: stageFt,
    discharge_cfs: observation.dischargeCfs,
    observedAt: observation.observedAt,
    status,
    qualifier: observation.qualifier || (provisional ? 'P' : null),
    wse_navd88_ft: wse,
    conversion_applied: wse != null,
    sourceUri: observation.sourceUri,
    error: null,
  };
}

export async function fetchLiveStationSnapshot(stationId: string): Promise<StationLiveSnapshot> {
  try {
    const payload = await fetchSnapshotPayload([stationId]);
    return toStationSnapshot(
      stationId,
      payload.observations?.find((observation) => observation.stationId === stationId),
    );
  } catch (error) {
    return {
      ...toStationSnapshot(stationId, undefined),
      error: error instanceof Error ? error.message : 'Hydrology source unavailable.',
    };
  }
}

/**
 * Fetch all configured stations in one server-side batch. Button-only entry point.
 * Individual station failures do not invent values.
 */
export async function fetchAllLiveStations(
  stationIds: readonly string[] = LIVE_FETCH_STATIONS,
): Promise<StationLiveSnapshot[]> {
  try {
    const payload = await fetchSnapshotPayload(stationIds);
    return stationIds.map((stationId) =>
      toStationSnapshot(
        stationId,
        payload.observations?.find((observation) => observation.stationId === stationId),
      ),
    );
  } catch (error) {
    return stationIds.map((stationId) => ({
      ...toStationSnapshot(stationId, undefined),
      error: error instanceof Error ? error.message : 'Hydrology source unavailable.',
    }));
  }
}
