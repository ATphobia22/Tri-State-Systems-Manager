/**
 * Swift data-fabric bridge (ported contract from TSMMapDataFabricService.swift).
 *
 * The Swift service's data contract (station shape + status vocabulary) is
 * preserved here so iOS payloads validate against the same rules as the web
 * console. Two deliberate divergences from the Swift original:
 *
 * 1. NO live polling. The Swift `fetchCommunityGauges()` called a live
 *    hydrologic endpoint. Live river telemetry is retired in this system;
 *    this module accepts only caller-supplied payloads and never fetches.
 * 2. NO fabricated fallbacks. The Swift `getOfflineFallbackStations()` returned
 *    invented stage/WSE readings with fake provenance signatures. Offline here
 *    means UNAVAILABLE — never invented observations.
 */

import {
  type NativeGaugeStation,
  type NativeGaugeStatusWire,
  mapNativeGaugeStatus,
} from './native-data-fabric';

/** Status vocabulary shared with the Swift contract. */
export type SwiftGaugeStatus = NativeGaugeStatusWire;

/** Swift TSMStreamgageStation wire shape. */
export interface SwiftGaugeStationPayload {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  stageFt: number;
  gageZeroNavd88Ft: number;
  navd88WseFt: number;
  status: string;
  provenanceSignature: string;
}

export interface SwiftBridgeResult {
  station: NativeGaugeStation | null;
  mappedStatus: ReturnType<typeof mapNativeGaugeStatus>;
  rejected: string | null;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Validate a Swift-shaped station payload and map it onto the repo's native
 * station type. Returns `rejected` with a reason instead of throwing, so
 * callers can fail closed.
 */
export function bridgeSwiftGaugeStation(
  payload: SwiftGaugeStationPayload,
): SwiftBridgeResult {
  if (!payload || typeof payload.id !== 'string' || payload.id.length === 0) {
    return { station: null, mappedStatus: 'unavailable', rejected: 'missing station id' };
  }
  for (const k of ['latitude', 'longitude', 'stageFt', 'gageZeroNavd88Ft', 'navd88WseFt'] as const) {
    if (!isFiniteNumber(payload[k])) {
      return { station: null, mappedStatus: 'unavailable', rejected: `non-finite ${k}` };
    }
  }
  if (Math.abs(payload.latitude) > 90 || Math.abs(payload.longitude) > 180) {
    return { station: null, mappedStatus: 'unavailable', rejected: 'coordinate out of range' };
  }
  // WSE must equal stage + gage zero within 0.01 ft, else the payload is
  // internally inconsistent — fail closed rather than display it.
  const wse = payload.stageFt + payload.gageZeroNavd88Ft;
  if (Math.abs(wse - payload.navd88WseFt) > 0.011) {
    return { station: null, mappedStatus: 'unavailable', rejected: 'wse inconsistent with stage+gageZero' };
  }
  const mappedStatus = mapNativeGaugeStatus(payload.status);
  const station: NativeGaugeStation = {
    id: payload.id,
    name: payload.name,
    latitude: payload.latitude,
    longitude: payload.longitude,
    stageFt: payload.stageFt,
    gageZeroNavd88Ft: payload.gageZeroNavd88Ft,
    navd88WseFt: payload.navd88WseFt,
    status: payload.status,
    provenanceSignature: payload.provenanceSignature,
  };
  return { station, mappedStatus, rejected: null };
}
