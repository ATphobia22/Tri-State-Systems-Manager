/**
 * Scope C — multi-station on-demand water levels (button-only).
 * No polling. No auto-fetch on load. Fail-closed per station.
 */

import { fetchUsgsLatestContinuous } from './usgs-direct';
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
  status: 'current' | 'provisional' | 'unavailable';
  qualifier: string | null;
  vertical_reference: 'GAGE_DATUM';
  wse_navd88_ft: number | null;
  conversion_applied: boolean;
  sourceUri: string | null;
  error: string | null;
};

/** Primary + local Tri-State constellation for button-fetch. */
export const LIVE_FETCH_STATIONS = [
  '03378500', // Wabash @ New Harmony (primary)
  '03322000', // Ohio @ Evansville
  '03322420', // Ohio @ Uniontown / J.T. Myers context
] as const;

export async function fetchLiveStationSnapshot(stationId: string): Promise<StationLiveSnapshot> {
  const retrievedAt = new Date().toISOString();
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
    sourceUri: null,
    error: null,
  };

  try {
    const obs = await fetchUsgsLatestContinuous(stationId, ['00065', '00060'], { timeoutMs: 12000 });
    let stageFt: number | null = null;
    let stageTime: string | null = null;
    let stageApproval: string | null = null;
    let sourceUri: string | null = null;
    let discharge: number | null = null;
    for (const o of obs) {
      if (o.parameterCode === '00065' && stageFt == null) {
        stageFt = o.value;
        stageTime = o.observedAt;
        stageApproval = o.approvalStatus;
        sourceUri = o.sourceUri;
      } else if (o.parameterCode === '00060' && discharge == null) {
        discharge = o.value;
      }
    }
    if (stageFt == null) {
      return { ...base, error: 'No stage observation in OGC response' };
    }
    const provisional = stageApproval === 'Provisional';
    const gageZero = meta?.conversionPublished === true ? meta.gageZeroNavd88Ft : null;
    const wse = gageZero != null ? stageFt + gageZero : null;
    return {
      ...base,
      stage_ft: stageFt,
      discharge_cfs: discharge,
      observedAt: stageTime,
      status: provisional ? 'provisional' : 'current',
      qualifier: provisional ? 'P' : 'A',
      wse_navd88_ft: wse,
      conversion_applied: wse != null,
      sourceUri,
      error: null,
    };
  } catch (e) {
    return {
      ...base,
      error: e instanceof Error ? e.message : 'Fetch failed',
    };
  }
}

/**
 * Fetch all configured stations in parallel. Button-only entry point.
 * Individual station failures do not invent values.
 */
export async function fetchAllLiveStations(
  stationIds: readonly string[] = LIVE_FETCH_STATIONS,
): Promise<StationLiveSnapshot[]> {
  return Promise.all(stationIds.map((id) => fetchLiveStationSnapshot(id)));
}
