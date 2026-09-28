/**
 * terrain-rgb-pipeline.test.ts — Mapbox Terrain-RGB decoding and the
 * fail-closed HTTPS template validation for the production tile pyramid.
 */
import { describe, expect, it } from 'vitest';
import { decodeTerrainRgb } from '../src/lib/flood-sim/world/live-data';
import { validateTerrainRgbUrlTemplate } from '../src/lib/terrain-rgb-contract';

describe('decodeTerrainRgb', () => {
  it('decodes the Mapbox Terrain-RGB encoding to feet', () => {
    // (0 m + 10000) * 10 = 100000 -> R=1, G=134, B=160
    const zero = decodeTerrainRgb(new Uint8ClampedArray([1, 134, 160, 255]), 1);
    expect(zero[0]).toBeCloseTo(0, 6);
    // ~360 ft ≈ 109.728 m -> enc 101097 -> 359.9 ft (0.1 m quantization)
    const enc = 101097;
    const rgb = new Uint8ClampedArray([(enc >> 16) & 255, (enc >> 8) & 255, enc & 255, 255]);
    expect(decodeTerrainRgb(rgb, 1)[0]).toBeCloseTo(360, 0);
  });

  it('throws on short buffers', () => {
    expect(() => decodeTerrainRgb(new Uint8ClampedArray(3), 1)).toThrow();
  });
});

describe('validateTerrainRgbUrlTemplate (fail-closed)', () => {
  const good = 'https://tiles.river-valley.org/terrain_3dep/{z}/{x}/{y}.png';

  it('accepts a real https template', () => {
    const s = validateTerrainRgbUrlTemplate(good);
    expect(s.enabled).toBe(true);
    if (s.enabled) expect(s.template).toBe(good);
  });

  it('rejects empty, non-https, and incomplete templates', () => {
    expect(validateTerrainRgbUrlTemplate('').enabled).toBe(false);
    expect(validateTerrainRgbUrlTemplate('   ').enabled).toBe(false);
    expect(
      validateTerrainRgbUrlTemplate('http://tiles.river-valley.org/terrain_3dep/{z}/{x}/{y}.png').enabled,
    ).toBe(false);
    expect(validateTerrainRgbUrlTemplate('https://tiles.river-valley.org/terrain_3dep/tile.png').enabled).toBe(
      false,
    );
    // Extension is not policed — only placeholders and insecure schemes fail closed.
    expect(
      validateTerrainRgbUrlTemplate('https://tiles.river-valley.org/terrain_3dep/{z}/{x}/{y}.jpg').enabled,
    ).toBe(true);
  });

  it('rejects placeholders and loopback hosts in production', () => {
    for (const bad of [
      'https://YOUR-HOST/terrain_3dep/{z}/{x}/{y}.png',
      'https://example.com/terrain_3dep/{z}/{x}/{y}.png',
      'https://tiles.example.com/terrain_3dep/{z}/{x}/{y}.png',
      'https://localhost:3443/terrain_3dep/{z}/{x}/{y}.png',
      'https://127.0.0.1:3443/terrain_3dep/{z}/{x}/{y}.png',
    ]) {
      expect(validateTerrainRgbUrlTemplate(bad).enabled).toBe(false);
    }
  });

  it('allows http://localhost only in dev (ops/terrain-rgb-server testing)', () => {
    const local = 'http://localhost:3443/terrain_3dep/{z}/{x}/{y}.png';
    expect(validateTerrainRgbUrlTemplate(local, { allowHttpLocal: true }).enabled).toBe(true);
    expect(validateTerrainRgbUrlTemplate(local).enabled).toBe(false);
  });
});
