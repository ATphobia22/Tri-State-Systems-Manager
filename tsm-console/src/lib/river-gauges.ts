import { tsmApiUrl } from './api-base';
import { resilientFetchJson } from './resilient-fetch';
import { fetchUsgsLatestContinuous } from './usgs-direct';

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
  provenancePath?: 'tsm-community' | 'usgs-direct' | 'lkg' | 'none';
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
  { id: 'nws-MTVI3', provider: 'NOAA_NWS', name: 'Ohio River at Mount Vernon, IN', river: 'Ohio River', nwsId: 'MTVI3', variables: ['stage'], status: 'active' },
];

export function gaugeEndpoint(_definition?: RiverGaugeDefinition): string {
  return tsmApiUrl('/api/hydrologic/community');
}

const LKG_KEY = 'tsm.river-gauges.lkg.v1';

function isFresh(observedAt: string | null, nowMs: number, maxAgeMs: number): boolean {
  if (!observedAt) return false;
  const timestamp = Date.parse(observedAt);
  return Number.isFinite(timestamp) && nowMs - timestamp >= 0 && nowMs - timestamp <= maxAgeMs;
}

function unavailable(
  definition: RiverGaugeDefinition,
  nowMs: number,
  error?: string,
  provenancePath: RiverGaugeObservation['provenancePath'] = 'none',
): RiverGaugeObservation {
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
    status: definition.status === 'active' ? 'unavailable' : 'candidate',
    dischargeCfs: null,
    sourceUri: null,
    provenancePath,
    error,
  };
}

function normalizeObservation(
  definition: RiverGaugeDefinition,
  payload: Record<string, unknown>,
  nowMs: number,
  maxAgeMs: number,
  provenancePath: RiverGaugeObservation['provenancePath'],
): RiverGaugeObservation {
  const value =
    typeof payload.value === 'number'
      ? payload.value
      : typeof payload.stage_ft === 'number'
        ? payload.stage_ft
        : null;
  const observedAt =
    typeof payload.observedAt === 'string'
      ? payload.observedAt
      : typeof payload.observation_time === 'string'
        ? payload.observation_time
        : null;
  const provider: GaugeProvider | 'UNKNOWN' =
    payload.provider === 'NOAA' || payload.provider === 'NOAA_NWS'
      ? 'NOAA_NWS'
      : payload.provider === 'USGS'
        ? 'USGS'
        : definition.provider;
  return {
    gaugeId: definition.usgsId ?? definition.nwsId ?? definition.id,
    provider,
    name: definition.name,
    river: definition.river,
    value: value != null && value !== -999 ? value : null,
    unit: typeof payload.unit === 'string' ? payload.unit : 'ft',
    observedAt,
    retrievedAt:
      typeof payload.retrievedAt === 'string' ? payload.retrievedAt : new Date(nowMs).toISOString(),
    qualifier: typeof payload.qualifier === 'string' ? payload.qualifier : null,
    provisional: Boolean(payload.provisional ?? true),
    status:
      value != null && value !== -999 && isFresh(observedAt, nowMs, maxAgeMs) ? 'current' : 'stale',
    dischargeCfs:
      typeof payload.dischargeCfs === 'number'
        ? payload.dischargeCfs
        : typeof payload.discharge_cfs === 'number'
          ? payload.discharge_cfs
          : null,
    sourceUri: typeof payload.sourceUri === 'string' ? payload.sourceUri : null,
    provenancePath,
  };
}

async function fetchUsgsFallback(
  definition: RiverGaugeDefinition,
  nowMs: number,
  maxAgeMs: number,
): Promise<RiverGaugeObservation | null> {
  if (!definition.usgsId) return null;
  try {
    const rows = await fetchUsgsLatestContinuous(definition.usgsId, ['00065', '00060'], {
      timeoutMs: 8000,
    });
    const stage = rows.find((r) => r.parameterCode === '00065') ?? rows[0];
    const discharge = rows.find((r) => r.parameterCode === '00060');
    if (!stage) return null;
    return normalizeObservation(
      definition,
      {
        provider: 'USGS',
        value: stage.value,
        unit: stage.unit,
        observedAt: stage.observedAt,
        retrievedAt: stage.retrievedAt,
        dischargeCfs: discharge?.value ?? null,
        sourceUri: stage.sourceUri,
        provisional: true,
      },
      nowMs,
      maxAgeMs,
      'usgs-direct',
    );
  } catch {
    return null;
  }
}

export async function fetchCommunityGauges(
  definitions: readonly RiverGaugeDefinition[] = COMMUNITY_RIVER_GAUGES,
  options: { fetcher?: typeof fetch; nowMs?: number; maxAgeMs?: number } = {},
): Promise<RiverGaugeObservation[]> {
  const nowMs = options.nowMs ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? 30 * 60 * 1000;
  const activeDefinitions = definitions.filter((d) => d.status === 'active');
  const result = new Map<string, RiverGaugeObservation>();

  for (const definition of definitions.filter((item) => item.status !== 'active')) {
    result.set(
      definition.usgsId ?? definition.nwsId ?? definition.id,
      unavailable(definition, nowMs, undefined, 'none'),
    );
  }

  const community = await resilientFetchJson<{
    observations?: Array<Record<string, unknown>>;
    stations?: Array<Record<string, unknown>>;
  }>(gaugeEndpoint(), {
    timeoutMs: 5000,
    retries: 2,
    lkgKey: LKG_KEY,
  });

  const observations = Array.isArray(community.data?.observations)
    ? community.data!.observations!
    : Array.isArray(community.data?.stations)
      ? community.data!.stations!
      : [];

  if (community.ok && observations.length) {
    for (const definition of activeDefinitions) {
      const key = definition.usgsId ?? definition.nwsId ?? definition.id;
      const remote = observations.find(
        (item) =>
          item.stationId === key ||
          item.usgs_id === key ||
          item.nws_id === key ||
          item.gaugeId === key,
      );
      if (remote) {
        result.set(
          key,
          normalizeObservation(definition, remote, nowMs, maxAgeMs, 'tsm-community'),
        );
      }
    }
  }

  await Promise.all(
    activeDefinitions.map(async (definition) => {
      const key = definition.usgsId ?? definition.nwsId ?? definition.id;
      const existing = result.get(key);
      if (existing && existing.value != null) return;
      const fallback = await fetchUsgsFallback(definition, nowMs, maxAgeMs);
      if (fallback) result.set(key, fallback);
      else if (!existing)
        result.set(
          key,
          unavailable(
            definition,
            nowMs,
            community.error,
            community.source === 'lkg' ? 'lkg' : 'none',
          ),
        );
    }),
  );

  if (community.source === 'lkg' && community.data) {
    for (const definition of activeDefinitions) {
      const key = definition.usgsId ?? definition.nwsId ?? definition.id;
      const existing = result.get(key);
      if (existing?.value != null) continue;
      const remote = observations.find((item) => item.stationId === key || item.usgs_id === key);
      if (remote) {
        result.set(key, normalizeObservation(definition, remote, nowMs, maxAgeMs, 'lkg'));
      }
    }
  }

  return definitions.map(
    (definition) =>
      result.get(definition.usgsId ?? definition.nwsId ?? definition.id) ??
      unavailable(definition, nowMs),
  );
}

export function startGaugePoll(
  onData: (rows: RiverGaugeObservation[]) => void,
  intervalMs = 60_000,
): () => void {
  let cancelled = false;
  const tick = async () => {
    if (cancelled) return;
    try {
      const rows = await fetchCommunityGauges();
      if (!cancelled) onData(rows);
    } catch {
      /* next tick */
    }
  };
  void tick();
  const id = setInterval(tick, intervalMs);
  return () => {
    cancelled = true;
    clearInterval(id);
  };
}
