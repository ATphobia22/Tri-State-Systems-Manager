import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEngineeringSection } from './engineering-section.mjs';

test('engineering section requires provenance for every physical layer', () => {
  const section = {
    sectionId: 'SEC-001',
    verticalDatum: 'NAVD88',
    layers: [
      { type: 'existing_ground', sourceId: '3DEP-001' },
      { type: 'soil_horizon', sourceId: 'SSURGO-001' },
      { type: 'foundation_preparation', sourceId: 'INV-001' },
      { type: 'approved_fill', sourceId: 'DM-002' },
      { type: 'compacted_lift', sourceId: 'QA-001' },
      { type: 'drainage', sourceId: 'DESIGN-001' },
      { type: 'finished_grade', sourceId: 'DESIGN-001' },
    ],
  };
  assert.equal(validateEngineeringSection(section).ok, true);
});

test('engineering section rejects unqualified fill and missing investigation evidence', () => {
  const result = validateEngineeringSection({
    sectionId: 'SEC-002',
    verticalDatum: 'NAVD88',
    layers: [{ type: 'approved_fill', sourceId: 'UNKNOWN' }],
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /fill|investigation/i);
});
