import { describe, it, expect } from 'vitest';
import {
  encodePlusCode,
  decodePlusCode,
  isValidPlusCode,
  isFullPlusCode,
  shortenPlusCode,
  recoverPlusCode,
} from '../src/lib/plusCodes';

// Public anchor: Point Township, Posey County, IN.
const ANCHOR_LAT = 37.845887;
const ANCHOR_LNG = -88.005075;

describe('plusCodes (vendored open-location-code)', () => {
  it('encodes the anchor to a valid full code', () => {
    const code = encodePlusCode(ANCHOR_LAT, ANCHOR_LNG);
    expect(isValidPlusCode(code)).toBe(true);
    expect(isFullPlusCode(code)).toBe(true);
  });

  it('decodes back to within the code cell of the anchor', () => {
    const code = encodePlusCode(ANCHOR_LAT, ANCHOR_LNG);
    const decoded = decodePlusCode(code);
    // A 10-digit code cell is ~13.5 m; center must be well within it.
    expect(Math.abs(decoded.latitude - ANCHOR_LAT)).toBeLessThan(0.001);
    expect(Math.abs(decoded.longitude - ANCHOR_LNG)).toBeLessThan(0.001);
    expect(decoded.codeLength).toBe(10);
  });

  it('round-trips shorten/recover near the anchor', () => {
    const full = encodePlusCode(ANCHOR_LAT, ANCHOR_LNG);
    const short = shortenPlusCode(full, ANCHOR_LAT, ANCHOR_LNG);
    expect(short).not.toBe(full);
    expect(recoverPlusCode(short, ANCHOR_LAT, ANCHOR_LNG)).toBe(full);
  });

  it('rejects malformed codes', () => {
    expect(isValidPlusCode('not a code')).toBe(false);
    expect(isValidPlusCode('')).toBe(false);
    expect(isValidPlusCode(null)).toBe(false);
  });
});
