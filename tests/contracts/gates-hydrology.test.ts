import assert from 'node:assert/strict';
import test from 'node:test';
import {
  convertGageHeightToNavd88,
  evaluateLomaLagVsBfe,
  requireHumanAuthoritySeal,
} from '../../packages/gates/src/index.ts';

test('gage conversion fails closed when unpublished', () => {
  const r = convertGageHeightToNavd88({
    siteNo: '03378500',
    gageHeightFt: 4.14,
    gageZeroNavd88Ft: 352.71,
    conversionPublished: false,
  });
  assert.equal(r.ok, false);
  assert.equal(r.wseNavd88Ft, null);
});

test('gage conversion succeeds only when published', () => {
  const r = convertGageHeightToNavd88({
    siteNo: '03378500',
    gageHeightFt: 4.14,
    gageZeroNavd88Ft: 352.71,
    conversionPublished: true,
  });
  assert.equal(r.ok, true);
  assert.ok(r.wseNavd88Ft != null && Math.abs(r.wseNavd88Ft - 356.85) < 1e-9);
});

test('LOMA LAG vs FEMA FIS reference BFE is arithmetic-only and not auto-filed', () => {
  const r = evaluateLomaLagVsBfe({ lagFtNavd88: 377.2, bfeFtNavd88: 369.1 });
  assert.equal(r.passes, true);
  assert.ok(Math.abs(r.freeboardFt - 8.1) < 1e-9);
  assert.equal(r.autoFile, false);
});

test('human authority seal requires identity and reason', () => {
  assert.equal(requireHumanAuthoritySeal({ humanAuthorized: true }).ok, false);
  assert.equal(
    requireHumanAuthoritySeal({
      humanAuthorized: true,
      reviewerIdentity: 'operator',
      reviewReason: 'field survey review',
      reviewedAt: new Date().toISOString(),
    }).ok,
    true,
  );
});
