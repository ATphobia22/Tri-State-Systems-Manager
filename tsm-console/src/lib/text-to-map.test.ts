/** Tests for text-to-map geocoding (local tri-state gazetteer). */
import { describe, expect, it } from 'vitest';
import {
  extractLocationIntent,
  geocodeText,
  getGazetteer,
  normalizeText,
} from './text-to-map';

describe('normalizeText', () => {
  it('expands Mt. to mount and strips punctuation', () => {
    expect(normalizeText('Mt. Vernon, IN')).toBe('mount vernon in');
    expect(normalizeText('  BONEBANK Road!! ')).toBe('bonebank road');
  });
});

describe('geocodeText', () => {
  it('matches the anchor site from a natural-language query', () => {
    const results = geocodeText('Show me flooding near Bonebank Road');
    const bonebank = results.find((r) => r.name === 'Bonebank Road');
    expect(bonebank).toBeDefined();
    expect(bonebank!.confidence).toBeGreaterThanOrEqual(0.9);
    expect(bonebank!.lat).toBeCloseTo(37.845887, 5);
    expect(bonebank!.lon).toBeCloseTo(-88.005075, 5);
    expect(bonebank!.type).toBe('road');
  });

  it('matches "Bonebank" alone to Bonebank Road', () => {
    const results = geocodeText('Bonebank');
    expect(results[0].name).toBe('Bonebank Road');
  });

  it('maps "Mt Vernon" to Mount Vernon, IN', () => {
    const results = geocodeText('Mt Vernon');
    expect(results[0].name).toBe('Mount Vernon, IN');
    expect(results[0].type).toBe('town');
  });

  it('maps "mt. carmel" to Mount Carmel, IL', () => {
    const results = geocodeText('mt. carmel');
    expect(results[0].name).toBe('Mount Carmel, IL');
  });

  it('prefers Old Shawneetown when "old" is present', () => {
    const results = geocodeText('Old Shawneetown');
    expect(results[0].name).toBe('Old Shawneetown, IL');
  });

  it('matches plain "Shawneetown" to Shawneetown, IL first', () => {
    const results = geocodeText('Shawneetown');
    expect(results[0].name).toBe('Shawneetown, IL');
    expect(results[0].confidence).toBe(1);
  });

  it('keeps "Cynthiana" in Indiana (no Kentucky entry exists)', () => {
    const results = geocodeText('Cynthiana');
    expect(results[0].name).toBe('Cynthiana, IN');
  });

  it('matches counties by type', () => {
    const results = geocodeText('Show me Posey County');
    const county = results.find((r) => r.type === 'county');
    expect(county).toBeDefined();
    expect(county!.name).toBe('Posey County, IN');
  });

  it('matches landmarks', () => {
    const results = geocodeText('Harmonie State Park');
    expect(results[0].name).toBe('Harmonie State Park');
    expect(results[0].type).toBe('landmark');
  });

  it('is case-insensitive', () => {
    const results = geocodeText('EVANSVILLE');
    expect(results[0].name).toBe('Evansville, IN');
  });

  it('tolerates small typos in single-token names', () => {
    const results = geocodeText('Evansvill');
    expect(results[0].name).toBe('Evansville, IN');
  });

  it('returns empty for unknown text', () => {
    expect(geocodeText('xyzzy nowhere 12345')).toEqual([]);
    expect(geocodeText('')).toEqual([]);
  });

  it('sorts by confidence, highest first', () => {
    const results = geocodeText('New Harmony Indiana flooding');
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
    }
  });
});

describe('extractLocationIntent', () => {
  it('detects flood intent', () => {
    const intent = extractLocationIntent('Show me flooding near Bonebank Road');
    expect(intent.action).toBe('flood');
    expect(intent.locations[0].name).toBe('Bonebank Road');
    expect(intent.rawText).toBe('Show me flooding near Bonebank Road');
  });

  it('detects zoom intent', () => {
    const intent = extractLocationIntent('zoom to New Harmony');
    expect(intent.action).toBe('zoom');
    expect(intent.locations[0].name).toBe('New Harmony, IN');
  });

  it('detects gauge intent from water-level phrasing', () => {
    const intent = extractLocationIntent("what's the water level at Shawneetown");
    expect(intent.action).toBe('gauge');
    expect(intent.locations[0].name).toBe('Shawneetown, IL');
  });

  it('detects show intent', () => {
    const intent = extractLocationIntent('Where is Hovey Lake?');
    expect(intent.action).toBe('show');
    expect(intent.locations[0].name).toBe('Hovey Lake');
  });

  it('returns null action when no intent pattern matches', () => {
    const intent = extractLocationIntent('Bonebank Road');
    expect(intent.action).toBeNull();
    expect(intent.locations[0].name).toBe('Bonebank Road');
  });

  it('flood intent wins over show when both patterns present', () => {
    const intent = extractLocationIntent('show me the flood map for Mount Vernon');
    expect(intent.action).toBe('flood');
  });
});

describe('getGazetteer', () => {
  it('covers the required tri-state places', () => {
    const names = getGazetteer().map((g) => g.name);
    for (const required of [
      'Bonebank Road',
      'Mount Vernon, IN',
      'New Harmony, IN',
      'Old Shawneetown, IL',
      'Evansville, IN',
      'Posey County, IN',
      'Henderson, KY',
      'Carmi, IL',
    ]) {
      expect(names).toContain(required);
    }
  });

  it('has valid WGS-84 coordinates for every entry', () => {
    for (const g of getGazetteer()) {
      expect(g.lat).toBeGreaterThanOrEqual(-90);
      expect(g.lat).toBeLessThanOrEqual(90);
      expect(g.lon).toBeGreaterThanOrEqual(-180);
      expect(g.lon).toBeLessThanOrEqual(180);
      // Tri-state bounding box sanity check.
      expect(g.lat).toBeGreaterThan(37.0);
      expect(g.lat).toBeLessThan(39.0);
      expect(g.lon).toBeGreaterThan(-89.0);
      expect(g.lon).toBeLessThan(-87.0);
    }
  });
});
