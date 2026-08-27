import { describe, expect, it } from 'vitest';
import { POSEY_EVIDENCE_LEDGER } from '../src/data/poseyEvidenceLedger';
import { POSEY_DATA_ASSETS } from '../src/data/poseyDataAcquisition';

describe('Posey evidence ledger', () => {
  it('requires human review for every evidence record', () => {
    expect(POSEY_EVIDENCE_LEDGER.length).toBeGreaterThan(0);
    expect(POSEY_EVIDENCE_LEDGER.every((entry) => entry.humanReviewRequired)).toBe(true);
  });
  it('does not classify legacy BFE claims as authoritative', () => {
    const legacy = POSEY_EVIDENCE_LEDGER.filter((entry) => entry.evidenceId.startsWith('LEGACY-'));
    expect(legacy.length).toBeGreaterThanOrEqual(2);
    expect(legacy.every((entry) => entry.tier === 'tier6_legacy')).toBe(true);
    expect(legacy.every((entry) => entry.regulatoryUse === 'not_authoritative')).toBe(true);
  });
  it('requires validation metadata for acquired assets', () => {
    expect(POSEY_DATA_ASSETS.length).toBeGreaterThanOrEqual(8);
    expect(POSEY_DATA_ASSETS.every((asset) => asset.validation.length >= 2)).toBe(true);
  });
});
