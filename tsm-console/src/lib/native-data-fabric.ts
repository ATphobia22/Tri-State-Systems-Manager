import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  candidateGaugeObservation,
  unavailableGaugeObservation,
  type RiverGaugeDefinition,
  type RiverGaugeObservation,
} from './river-gauges';

/**
 * Native iOS data-fabric bridge.
 *
 * Wraps the `TSMDataFabric` Capacitor plugin (see
 * `ios/App/App/TSMDataFabricPlugin.swift`), which fetches live USGS/NOAA river
 * observations through the native `TSMMapDataFabricService` instead of the
 * browser `fetch` path.
 *
 * Source-priority design: on a native runtime where the plugin is available,
 * the native path is preferred (it is the platform path — same endpoint,
 * native networking, native datum handling). Everywhere else — web, PWA,
 * desktop, or any native failure — the existing web fetch path is used, and
 * its behavior is unchanged. A native failure never produces fabricated
 * "live" data: in `auto` mode it falls back to the web path (which is itself
 * fail-closed); in explicit `native` mode it yields `unavailable`
 * observations.
 */

export const NATIVE_DATA_FABRIC_PLUGIN_NAME = 'TSMDataFabric';

/** Wire-format gauge statuses emitted by the native plugin. */
export type NativeGaugeStatusWire =
  | 'LIVE OBSERVATION'
  | 'STALE'
  | 'CANDIDATE'
  | 'SOURCE UNAVAILABLE';

/** Native station payload as resolved by `TSMDataFabric.fetchGauges()`. */
export interface NativeGaugeStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  stageFt: number;
  gageZeroNavd88Ft: number;
  navd88WseFt: number;
  /** Wire string; see {@link NativeGaugeStatusWire}. Unknown values fail closed. */
  status: string;
  provenanceSignature: string;
}

export interface NativeFetchGaugesResult {
  stations: NativeGaugeStation[];
  error?: string;
}

interface TSMDataFabricPlugin {
  fetchGauges(): Promise<NativeFetchGaugesResult>;
}

/**
 * Minimal bridge over the Capacitor plugin. The interface exists so tests
 * (and future platforms) can inject a fake without touching Capacitor.
 */
export interface NativeDataFabricBridge {
  isAvailable(): boolean;
  fetchGauges(): Promise<NativeFetchGaugesResult>;
}

const plugin = registerPlugin<TSMDataFabricPlugin>(NATIVE_DATA_FABRIC_PLUGIN_NAME);

export function createCapacitorBridge(): NativeDataFabricBridge {
  return {
    isAvailable(): boolean {
      try {
        return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable(NATIVE_DATA_FABRIC_PLUGIN_NAME);
      } catch {
        return false;
      }
    },
    fetchGauges(): Promise<NativeFetchGaugesResult> {
      return plugin.fetchGauges();
    },
  };
}

const NATIVE_STATUS_MAP: Record<string, RiverGaugeObservation['status']> = {
  'LIVE OBSERVATION': 'current',
  'STALE': 'stale',
  'CANDIDATE': 'candidate',
  'SOURCE UNAVAILABLE': 'unavailable',
};

/**
 * Maps a native wire status onto the app's gauge model.
 * Any unknown or malformed value fails closed to `'unavailable'`.
 */
export function mapNativeGaugeStatus(wireStatus: unknown): RiverGaugeObservation['status'] {
  if (typeof wireStatus === 'string' && wireStatus in NATIVE_STATUS_MAP) {
    return NATIVE_STATUS_MAP[wireStatus];
  }
  return 'unavailable';
}

/** Lookup keys for matching a native station id to a gauge definition. */
function definitionLookupKeys(definition: RiverGaugeDefinition): string[] {
  const keys: string[] = [];
  const rawKeys = [definition.usgsId, definition.nwsId, definition.id];
  for (const key of rawKeys) {
    if (!key) continue;
    keys.push(key);
    if (key === definition.usgsId) keys.push(`USGS-${key}`);
    if (key === definition.nwsId) keys.push(`NOAA-${key}`);
  }
  return keys;
}

function findNativeStation(
  definition: RiverGaugeDefinition,
  stationsById: ReadonlyMap<string, NativeGaugeStation>,
): NativeGaugeStation | undefined {
  for (const key of definitionLookupKeys(definition)) {
    const found = stationsById.get(key);
    if (found) return found;
  }
  return undefined;
}

function deriveProvider(definition: RiverGaugeDefinition, station: NativeGaugeStation): RiverGaugeObservation['provider'] {
  if (station.id.startsWith('USGS-')) return 'USGS';
  if (station.id.startsWith('NOAA-')) return 'NOAA_NWS';
  return definition.provider;
}

function mapNativeStation(
  definition: RiverGaugeDefinition,
  station: NativeGaugeStation,
  nowMs: number,
  error?: string,
): RiverGaugeObservation {
  const stageFt = typeof station.stageFt === 'number' && Number.isFinite(station.stageFt) ? station.stageFt : null;
  const claimedStatus = mapNativeGaugeStatus(station.status);
  // Fail closed: a "live" claim without a valid numeric stage value is not live.
  const status = claimedStatus === 'current' && stageFt === null ? 'unavailable' : claimedStatus;
  const stageError =
    claimedStatus === 'current' && stageFt === null
      ? 'Native station reported live without a numeric stage value'
      : error;
  return {
    gaugeId: definition.usgsId ?? definition.nwsId ?? definition.id,
    provider: deriveProvider(definition, station),
    name: definition.name,
    river: definition.river,
    value: stageFt,
    unit: 'ft',
    observedAt: null,
    retrievedAt: new Date(nowMs).toISOString(),
    qualifier: null,
    provisional: false,
    status,
    dischargeCfs: null,
    sourceUri: null,
    ...(stageError ? { error: stageError } : {}),
  };
}

export interface FetchNativeGaugeObservationsOptions {
  nowMs?: number;
  bridge?: NativeDataFabricBridge;
}

/**
 * Fetches gauge observations through the native data-fabric plugin and maps
 * them onto the app's gauge model, keyed to the given definitions.
 * Candidate (non-active) definitions keep their `candidate` status.
 * Throws if the native call fails — callers decide between web fallback
 * (`auto`) and fail-closed `unavailable` output (`native`).
 */
export async function fetchNativeGaugeObservations(
  definitions: readonly RiverGaugeDefinition[],
  options: FetchNativeGaugeObservationsOptions = {},
): Promise<RiverGaugeObservation[]> {
  const nowMs = options.nowMs ?? Date.now();
  const bridge = options.bridge ?? createCapacitorBridge();
  const result = await bridge.fetchGauges();
  const stationsById = new Map<string, NativeGaugeStation>();
  if (Array.isArray(result.stations)) {
    for (const station of result.stations) {
      if (station && typeof station.id === 'string') stationsById.set(station.id, station);
    }
  }
  return definitions.map((definition) => {
    if (definition.status !== 'active') return candidateGaugeObservation(definition);
    const station = findNativeStation(definition, stationsById);
    if (!station) {
      return unavailableGaugeObservation(
        definition,
        nowMs,
        result.error ?? 'Station not returned by native data fabric',
      );
    }
    return mapNativeStation(definition, station, nowMs, result.error);
  });
}
