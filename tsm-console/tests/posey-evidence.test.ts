import { describe, expect, it } from 'vitest';
import { POSEY_EVIDENCE, POSEY_GRANTS, POSEY_PRIORITIES } from '../src/data/poseyEvidence';

describe('Posey evidence registry', () => {
  it('contains official government sources only in verified records', () => {
    const verified = POSEY_EVIDENCE.filter((record) => record.status === 'verified');
    expect(verified.length).toBeGreaterThan(0);
    expect(verified.every((record) => record.authorityLevel === 'government')).toBe(true);
    expect(verified.every((record) => record.sourceUrl.startsWith('https://'))).toBe(true);
  });

  it('keeps conflicting legacy engineering claims out of verified evidence', () => {
    const legacy = POSEY_EVIDENCE.filter((record) => record.status === 'legacy_unverified');
    expect(legacy.some((record) => record.claim.includes('375.0'))).toBe(true);
    expect(legacy.some((record) => record.claim.includes('368.7'))).toBe(true);
    expect(legacy.every((record) => record.authorityLevel === 'project')).toBe(true);
  });

  it('contains benefit priorities with measurable outcomes', () => {
    expect(POSEY_PRIORITIES.length).toBeGreaterThanOrEqual(5);
    expect(POSEY_PRIORITIES.every((priority) => priority.outcomes.length >= 2)).toBe(true);
    expect(POSEY_PRIORITIES.every((priority) => priority.firstActions.length >= 2)).toBe(true);
  });

  it('marks the archived BRIC opportunity as closed', () => {
    const bric = POSEY_GRANTS.find((grant) => grant.id === 'FEMA-BRIC-ARCHIVE');
    expect(bric?.status).toBe('closed');
    expect(bric?.sourceUrl).toContain('grants.gov');
  });
});
