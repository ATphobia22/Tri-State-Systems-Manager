/**
 * Plus Codes (Open Location Code) wrapper for offline field geocoding.
 *
 * Vendored implementation: google/open-location-code, js/src/openlocationcode.js
 * (Apache-2.0, Copyright 2014 Google Inc.). The vendored file is kept verbatim
 * at ./vendor/openlocationcode.js so field evidence handles can be generated
 * and decoded with zero network access — a requirement for the air-gapped
 * deployment target.
 *
 * A Plus Code is a short, ~10-11 character code that works where street
 * addresses don't. Field crews can stamp evidence photos and sensor readings
 * with a code instead of raw coordinates.
 */

import OpenLocationCode from './vendor/openlocationcode.js';

export interface DecodedPlusCode {
  /** Latitude of the code area center, degrees. */
  latitude: number;
  /** Longitude of the code area center, degrees. */
  longitude: number;
  /** South-west corner latitude, degrees. */
  latitudeLo: number;
  /** North-east corner latitude, degrees. */
  longitudeHi: number;
  /** Number of significant digits in the code. */
  codeLength: number;
}

/**
 * Encode a latitude/longitude into a full Plus Code.
 * @param codeLength significant digits, 10 is typical (~13.5 m x 13.5 m).
 */
export function encodePlusCode(
  latitude: number,
  longitude: number,
  codeLength = 10,
): string {
  return OpenLocationCode.encode(latitude, longitude, codeLength);
}

/** Decode a full Plus Code into its center point and bounding area. */
export function decodePlusCode(code: string): DecodedPlusCode {
  const area = OpenLocationCode.decode(code);
  return {
    latitude: area.latitudeCenter,
    longitude: area.longitudeCenter,
    latitudeLo: area.latitudeLo,
    longitudeHi: area.longitudeHi,
    codeLength: area.codeLength,
  };
}

/** True when the code is syntactically valid (full or short). */
export function isValidPlusCode(code: unknown): boolean {
  return OpenLocationCode.isValid(code);
}

/** True when the code is a full (non-shortened) code. */
export function isFullPlusCode(code: string): boolean {
  return OpenLocationCode.isFull(code);
}

/**
 * Shorten a full code relative to a nearby reference location, for display.
 * The result can be recovered with recoverPlusCode() near that reference.
 */
export function shortenPlusCode(
  code: string,
  refLatitude: number,
  refLongitude: number,
): string {
  return OpenLocationCode.shorten(code, refLatitude, refLongitude);
}

/** Recover a short code into a full code near a reference location. */
export function recoverPlusCode(
  shortCode: string,
  refLatitude: number,
  refLongitude: number,
): string {
  return OpenLocationCode.recoverNearest(shortCode, refLatitude, refLongitude);
}
