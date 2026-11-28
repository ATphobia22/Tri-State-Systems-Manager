import { describe, expect, it } from 'vitest';
import { toH3Cell } from '../src/lib/h3-spatial-fabric';
import { dueEnvironmentalEvents, migrateLegacySave, validateEnvironmentalRecord } from '../src/lib/h3-environmental-journal';

describe('H3 persistent environmental journal contracts', () => {
  const cellId = toH3Cell(38.130891, -87.941415, 9);
  it('requires provenance for observed environmental values', () => {
    const record = { recordId: 'obs-1', cellId, recordedAt: '2026-11-28T12:00:00Z', kind: 'weather', evidenceClass: 'observed', values: { temperatureC: 12 } } as const;
    expect(() => validateEnvironmentalRecord(record)).toThrow(/provenance/);
    expect(() => validateEnvironmentalRecord({ ...record, sourceUri: 'https://agency.example/data', sourceSha256: 'a'.repeat(64) })).not.toThrow();
  });
  it('rejects invalid H3 IDs and non-finite values', () => {
    expect(() => validateEnvironmentalRecord({ recordId: 'x', cellId: 'not-h3', recordedAt: '2026-01-01', kind: 'weather', evidenceClass: 'simulated', values: {} })).toThrow(/H3/);
    expect(() => validateEnvironmentalRecord({ recordId: 'x', cellId, recordedAt: '2026-01-01', kind: 'weather', evidenceClass: 'simulated', values: { stage: NaN } })).toThrow(/invalid/);
  });
  it('migrates legacy cell history without inventing a spatial identity', () => {
    const migrated = migrateLegacySave({ visited: true, cellHistory: [{ legacyId: 'old-4', season: 'winter' }] });
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.cellHistory).toEqual([{ legacyId: 'old-4', season: 'winter', h3Cell: null, spatialStatus: 'requires-source-remap' }]);
    expect(migrateLegacySave(migrated)).toEqual(migrated);
  });
  it('orders due events deterministically and leaves future events queued', () => {
    const events = [{ eventId: 'b', dueAt: '2026-01-01T00:00:00Z' }, { eventId: 'a', dueAt: '2026-01-01T00:00:00Z' }, { eventId: 'later', dueAt: '2027-01-01T00:00:00Z' }];
    expect(dueEnvironmentalEvents(events, '2026-06-01T00:00:00Z').map(e => e.eventId)).toEqual(['a', 'b']);
  });
});
