import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFirmEvidenceAvailability, linkFirmEvidenceToProject } from '../server/grants/firm-evidence-linkage.mjs';

test('grant linkage identifies only source-supported claims', () => {
  const link = linkFirmEvidenceToProject('18129C0265C', 'POSEY-BRIC-001');
  assert.deepEqual(link.supported_claims, ['panel_identity', 'published_map_reference']);
  assert.ok(link.unsupported_claims.includes('grant_eligibility'));
  assert.equal(link.human_review_required, true);
});

test('availability remains source-only while georeferencing is unvalidated', () => {
  const result = evaluateFirmEvidenceAvailability('18129C0265C', {
    panel_number: '18129C0265C',
    georeferencing: { status: 'FAILED_CLOSED_MISSING_MATCHING_WORLD_FILE' },
  });
  assert.equal(result.available, true);
  assert.equal(result.source_only, true);
  assert.equal(result.human_review_required, true);
});
