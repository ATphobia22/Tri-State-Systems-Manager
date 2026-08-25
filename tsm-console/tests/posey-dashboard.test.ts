import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Posey resilience dashboard contract', () => {
  const source = readFileSync(new URL('../src/routes/PoseyResilienceDashboard.tsx', import.meta.url), 'utf8');

  it('contains benefit-first and human-authority messaging', () => {
    expect(source).toContain('Posey County Resilience & Community Benefit Platform');
    expect(source).toContain('Human authority remains final.');
    expect(source).toContain('Evidence integrity');
    expect(source).toContain('Funding pathways');
  });

  it('exposes official source links without making automated decisions', () => {
    expect(source).toContain('Official source ↗');
    expect(source).toContain('Issuing agency / official notice ↗');
    expect(source).toContain('does not make regulatory, property, funding, health or safety decisions');
  });
});
