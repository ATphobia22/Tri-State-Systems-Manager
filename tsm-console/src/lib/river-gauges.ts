import {
  createCapacitorBridge,
  fetchNativeGaugeObservations,
  type NativeDataFabricBridge,
} from './native-data-fabric';

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

export function gaugeEndpoint(_definition?: RiverGaugeDefinition): string {
  return '/api/hydrologic/community';
}

function isFresh(observedAt: string | null, nowMs: number, maxAgeMs: number): boolean {
  if (!observedAt) return false;
  const timestamp = Date.parse(observedAt);
  return Number.isFinite(timestamp) && nowMs - timestamp >= 0 && nowMs - timestamp <= maxAgeMs;
}

export function unavailableGaugeObservation(definition: RiverGaugeDefinition, nowMs: number, error?: string): RiverGaugeObservation {
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
    ...(error ? { error } : {}),
  };
}

function normalizeObservation(definition: RiverGaugeDefinition, payload: Record<string, unknown>, nowMs: number, maxAgeMs: number): RiverGaugeObservation {
  const observedAt = typeof payload.observedAt === 'string' ? payload.observedAt : null;
  const value = typeof payload.value === 'number' ? payload.value : null;
  const provider: GaugeProvider | 'UNKNOWN' = payload.provider === 'NOAA' ? 'NOAA_NWS' : payload.provider === 'USGS' ? 'USGS' : 'UNKNOWN';
  return {
    gaugeId: typeof payload.stationId === 'string' ? payload.stationId : definition.usgsId ?? definition.nwsId ?? definition.id,
    provider,
    name: definition.name,
    river: definition.river,
    value,
    unit: typeof payload.observation === 'object' && payload.observation !== null && typeof (payload.observation as Record<string, unknown>).unit === 'string' ? String((payload.observation as Record<string, unknown>).unit) : 'ft',
    observedAt,
    retrievedAt: typeof payload.retrievedAt === 'string' ? payload.retrievedAt : new Date(nowMs).toISOString(),
    qualifier: typeof payload.qualifier === 'string' ? payload.qualifier : null,
    provisional: payload.qualifier === 'P',
    status: isFresh(observedAt, nowMs, maxAgeMs) && value !== null ? 'current' : 'stale',
    dischargeCfs: typeof payload.dischargeCfs === 'number' ? payload.dischargeCfs : null,
    sourceUri: typeof payload.sourceUri === 'string' ? payload.sourceUri : null,
  };
}

export function candidateGaugeObservation(definition: RiverGaugeDefinition): RiverGaugeObservation {
  const key = definition.usgsId ?? definition.nwsId ?? definition.id;
  return {
    gaugeId: key,
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

/**
 * Which data path supplies gauge observations.
 * - `'auto'` (default): prefer the native data-fabric plugin when available,
 *   fall back to the web fetch path on any native failure.
 * - `'native'`: use only the native plugin; a native failure yields
 *   `unavailable` observations (fail closed, no silent web fallback).
 * - `'web'`: use only the existing web fetch path.
 */
export type GaugeDataSource = 'auto' | 'native' | 'web';

export interface FetchCommunityGaugesOptions {
  fetcher?: typeof fetch;
  nowMs?: number;
  maxAgeMs?: number;
  source?: GaugeDataSource;
  nativeBridge?: NativeDataFabricBridge;
}

/**
 * Reports which data path `fetchCommunityGauges` will prefer with default
 * options. Useful for provenance display; the actual path used on a given
 * refresh may still fall back to web if the native call fails.
 */
export function getPreferredGaugeDataSource(nativeBridge?: NativeDataFabricBridge): 'native' | 'web' {
  const bridge = nativeBridge ?? createCapacitorBridge();
  try {
    return bridge.isAvailable() ? 'native' : 'web';
  } catch {
    return 'web';
  }
}

export async function fetchCommunityGauges(
  definitions: readonly RiverGaugeDefinition[] = COMMUNITY_RIVER_GAUGES,
  options: FetchCommunityGaugesOptions = {},
): Promise<RiverGaugeObservation[]> {
  const fetcher = options.fetcher ?? fetch;
  const nowMs = options.nowMs ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? 30 * 60 * 1000;
  const source = options.source ?? 'auto';

  if (source !== 'web') {
    const bridge = options.nativeBridge ?? createCapacitorBridge();
    let nativeAvailable = false;
    try {
      nativeAvailable = bridge.isAvailable();
    } catch {
      nativeAvailable = false;
    }
    if (source === 'native' || (source === 'auto' && nativeAvailable)) {
      try {
        return await fetchNativeGaugeObservations(definitions, { nowMs, bridge });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Native data fabric request failed';
        if (source === 'native') {
          // Explicit native request: fail closed rather than silently swapping sources.
          return definitions.map((definition) =>
            definition.status === 'active'
              ? unavailableGaugeObservation(definition, nowMs, message)
              : candidateGaugeObservation(definition),
          );
        }
        // 'auto': fall through to the web fetch path below.
      }
    }
  }

  const result = new Map<string, RiverGaugeObservation>();
  for (const definition of definitions.filter((item) => item.status !== 'active')) {
    result.set(definition.usgsId ?? definition.nwsId ?? definition.id, candidateGaugeObservation(definition));
  }
  try {
    const response = await fetcher(gaugeEndpoint(), { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as { observations?: Array<Record<string, unknown>> };
    const observations = Array.isArray(payload.observations) ? payload.observations : [];
    for (const definition of activeDefinitions(definitions)) {
      const key = definition.usgsId ?? definition.nwsId ?? definition.id;
      const remote = observations.find((item) => item.stationId === key);
      result.set(key, remote ? normalizeObservation(definition, remote, nowMs, maxAgeMs) : unavailableGaugeObservation(definition, nowMs, 'Station not returned by community endpoint'));
    }
  } catch (error) {
    for (const definition of activeDefinitions(definitions)) {
      const key = definition.usgsId ?? definition.nwsId ?? definition.id;
      result.set(key, unavailableGaugeObservation(definition, nowMs, error instanceof Error ? error.message : 'Unknown upstream error'));
    }
  }
  return definitions.map((definition) => result.get(definition.usgsId ?? definition.nwsId ?? definition.id) ?? unavailableGaugeObservation(definition, nowMs));
}

function activeDefinitions(definitions: readonly RiverGaugeDefinition[]): RiverGaugeDefinition[] {
  return definitions.filter((definition) => definition.status === 'active');
}
