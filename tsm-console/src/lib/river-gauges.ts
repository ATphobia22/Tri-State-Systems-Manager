export type GaugeProvider = 'USGS' | 'NOAA_NWS';

export interface RiverGaugeDefinition {
  id: string;
  provider: GaugeProvider;
  name: string;
  river: string;
  usgsId?: string;
  nwsId?: string;
  variables: readonly string[];
  status: 'active' | 'candidate_realtime_station' | 'historical_or_research_reference';
}

export interface RiverGaugeObservation {
  gaugeId: string;
  provider: GaugeProvider | 'UNKNOWN';
  name: string;
  river: string;
  value: number | null;
  unit: string | null;
  observedAt: string | null;
  retrievedAt: string | null;
  qualifier: string | null;
  provisional: boolean;
  status: 'current' | 'stale' | 'unavailable' | 'candidate';
  dischargeCfs: number | null;
  sourceUri: string | null;
  error?: string;
}

export const COMMUNITY_RIVER_GAUGES: readonly RiverGaugeDefinition[] = [
  { id: 'usgs-03378500', provider: 'USGS', name: 'Wabash River at New Harmony, IN', river: 'Wabash River', usgsId: '03378500', variables: ['00065', '00060'], status: 'active' },
  { id: 'usgs-03322000', provider: 'USGS', name: 'Ohio River at Evansville, IN', river: 'Ohio River', usgsId: '03322000', variables: ['00065', '00060'], status: 'active' },
  { id: 'usgs-03304300', provider: 'USGS', name: 'Ohio River at Newburgh Lock and Dam, IN', river: 'Ohio River', usgsId: '03304300', nwsId: 'NBGI3', variables: ['00065'], status: 'active' },
  { id: 'usgs-03322420', provider: 'USGS', name: 'Ohio River at J.T. Myers Dam Pool near Uniontown, KY', river: 'Ohio River', usgsId: '03322420', variables: ['00065'], status: 'candidate_realtime_station' },
  { id: 'usgs-03381700', provider: 'USGS', name: 'Ohio River at Old Shawneetown, IL-KY', river: 'Ohio River', usgsId: '03381700', nwsId: 'SHNI2', variables: ['00065', '00060'], status: 'active' },
  { id: 'usgs-03399800', provider: 'USGS', name: 'Ohio River at Smithland Dam, Smithland, KY', river: 'Ohio River', usgsId: '03399800', variables: ['00065_headwater', '00065_tailwater', '00060'], status: 'active' },
  { id: 'usgs-03303280', provider: 'USGS', name: 'Ohio River at Cannelton Dam at Cannelton, IN', river: 'Ohio River', usgsId: '03303280', variables: ['00065', '00060'], status: 'active' },
  { id: 'usgs-03612600', provider: 'USGS', name: 'Ohio River at Olmsted, IL', river: 'Ohio River', usgsId: '03612600', variables: ['00065_headwater', '00065_tailwater', '00060'], status: 'active' },
  { id: 'usgs-03277200', provider: 'USGS', name: 'Ohio River at Markland Dam near Warsaw, KY', river: 'Ohio River', usgsId: '03277200', variables: ['00065', '00060'], status: 'active' },
  { id: 'usgs-03293600', provider: 'USGS', name: 'Ohio River at McAlpine Dam — Headwater', river: 'Ohio River', usgsId: '03293600', variables: ['00065'], status: 'active' },
  { id: 'usgs-03294500', provider: 'USGS', name: 'Ohio River at Louisville, KY', river: 'Ohio River', usgsId: '03294500', variables: ['00065', '00060'], status: 'active' },
];

export function gaugeEndpoint(definition: RiverGaugeDefinition): string {
  const params = new URLSearchParams({ source: definition.provider === 'NOAA_NWS' ? 'noaa' : 'usgs' });
  if (definition.usgsId) params.set('usgs_id', definition.usgsId);
  if (definition.nwsId) params.set('nws_id', definition.nwsId);
  return `/api/hydrologic/live?${params.toString()}`;
}

function isFresh(observedAt: string | null, nowMs: number, maxAgeMs: number): boolean {
  if (!observedAt) return false;
  const timestamp = Date.parse(observedAt);
  return Number.isFinite(timestamp) && nowMs - timestamp >= 0 && nowMs - timestamp <= maxAgeMs;
}

export async function fetchCommunityGauge(
  definition: RiverGaugeDefinition,
  options: { fetcher?: typeof fetch; nowMs?: number; maxAgeMs?: number } = {},
): Promise<RiverGaugeObservation> {
  const fetcher = options.fetcher ?? fetch;
  const nowMs = options.nowMs ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? 30 * 60 * 1000;

  if (definition.status !== 'active') {
    return {
      gaugeId: definition.usgsId ?? definition.nwsId ?? definition.id,
      provider: definition.provider,
      name: definition.name,
      river: definition.river,
      value: null,
      unit: null,
      observedAt: null,
      retrievedAt: null,
      qualifier: null,
      provisional: false,
      status: 'candidate',
      dischargeCfs: null,
      sourceUri: null,
    };
  }

  try {
    const response = await fetcher(gaugeEndpoint(definition), { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as Record<string, unknown>;
    const observedAt = typeof payload.observedAt === 'string' ? payload.observedAt : null;
    const value = typeof payload.value === 'number' ? payload.value : null;
    return {
      gaugeId: typeof payload.gaugeId === 'string' ? payload.gaugeId : definition.usgsId ?? definition.nwsId ?? definition.id,
      provider: payload.source === 'NOAA' ? 'NOAA_NWS' : payload.source === 'USGS' ? 'USGS' : 'UNKNOWN',
      name: definition.name,
      river: definition.river,
      value,
      unit: typeof payload.unit === 'string' ? payload.unit : 'ft',
      observedAt,
      retrievedAt: typeof payload.retrievedAt === 'string' ? payload.retrievedAt : new Date(nowMs).toISOString(),
      qualifier: typeof payload.qualifier === 'string' ? payload.qualifier : null,
      provisional: payload.status === 'provisional' || payload.qualifier === 'P',
      status: isFresh(observedAt, nowMs, maxAgeMs) && value !== null ? 'current' : 'stale',
      dischargeCfs: typeof payload.discharge_cfs === 'number' ? payload.discharge_cfs : null,
      sourceUri: typeof payload.sourceUri === 'string' ? payload.sourceUri : null,
    };
  } catch (error) {
    return {
      gaugeId: definition.usgsId ?? definition.nwsId ?? definition.id,
      provider: definition.provider,
      name: definition.name,
      river: definition.river,
      value: null,
      unit: null,
      observedAt: null,
      retrievedAt: new Date(nowMs).toISOString(),
      qualifier: null,
      provisional: false,
      status: 'unavailable',
      dischargeCfs: null,
      sourceUri: null,
      error: error instanceof Error ? error.message : 'Unknown upstream error',
    };
  }
}

export async function fetchCommunityGauges(
  definitions: readonly RiverGaugeDefinition[] = COMMUNITY_RIVER_GAUGES,
  options: { fetcher?: typeof fetch; nowMs?: number; maxAgeMs?: number } = {},
): Promise<RiverGaugeObservation[]> {
  return Promise.all(definitions.map((definition) => fetchCommunityGauge(definition, options)));
}
