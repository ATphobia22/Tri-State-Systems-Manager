/**
 * Type declarations for the vendored Plus Codes implementation.
 * Source: google/open-location-code, js/src/openlocationcode.js (Apache-2.0).
 * This file sits next to openlocationcode.js so TypeScript pairs them.
 */

export interface CodeArea {
  latitudeLo: number;
  longitudeLo: number;
  latitudeHi: number;
  longitudeHi: number;
  latitudeCenter: number;
  longitudeCenter: number;
  codeLength: number;
}

declare const OpenLocationCode: {
  encode(latitude: number, longitude: number, codeLength?: number): string;
  decode(code: string): CodeArea;
  isValid(code: unknown): boolean;
  isShort(code: string): boolean;
  isFull(code: string): boolean;
  shorten(code: string, latitude: number, longitude: number): string;
  recoverNearest(code: string, latitude: number, longitude: number): string;
};

export default OpenLocationCode;
