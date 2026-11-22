/** Offline, navigation-only Open Location Code (Plus Code) gate for TSM Atlas. */
import { decodePlusCode, isFullPlusCode } from './plusCodes';

const REGION_BOUNDS = { west: -89.6, south: 36.9, east: -86.8, north: 38.8 } as const;

export interface AtlasLocationCode {
  readonly code: string;
  readonly latitude: number;
  readonly longitude: number;
}

/** Never geocode street addresses or call Google Maps; do not claim survey-grade accuracy. */
export function resolveAtlasPlusCode(input: string): AtlasLocationCode {
  const code = input.trim().toUpperCase();
  if (!isFullPlusCode(code)) {
    throw new Error('Enter a full Plus Code, including its + separator. Short codes need a separate reference point.');
  }
  const position = decodePlusCode(code);
  if (position.codeLength < 10) {
    throw new Error('Use at least a 10-character Plus Code to navigate this map.');
  }
  const { latitude, longitude } = position;
  if (![latitude, longitude].every(Number.isFinite)) {
    throw new Error('Plus Code did not decode to finite WGS84 coordinates.');
  }
  if (longitude < REGION_BOUNDS.west || longitude > REGION_BOUNDS.east ||
      latitude < REGION_BOUNDS.south || latitude > REGION_BOUNDS.north) {
    throw new Error('Location is outside the Tri-State Atlas envelope. This is a regional map, not a global geocoder.');
  }
  return { code, latitude, longitude };
}
