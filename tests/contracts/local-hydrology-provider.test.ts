import assert from 'node:assert/strict';
import test from 'node:test';
import { LocalCapabilityProvider } from '../../providers/local/src/index.ts';

test('local provider converts gage only when published', async () => {
  const provider = new LocalCapabilityProvider();
  const denied = await provider.execute({
    capability: 'hydrology.convert_gage',
    input: {
      siteNo: '03378500',
      gageHeightFt: 4.14,
      gageZeroNavd88Ft: 352.71,
      conversionPublished: false,
    },
    context: { requestId: 'req-gage-1', permissions: { allow: [] } },
  });
  assert.equal(denied.success, false);

  const ok = await provider.execute({
    capability: 'hydrology.convert_gage',
    input: {
      siteNo: '03378500',
      gageHeightFt: 4.14,
      gageZeroNavd88Ft: 352.71,
      conversionPublished: true,
    },
    context: { requestId: 'req-gage-2', permissions: { allow: [] } },
  });
  assert.equal(ok.success, true);
  const wse = (ok.output as { wseNavd88Ft: number }).wseNavd88Ft;
  assert.ok(Math.abs(wse - 356.85) < 1e-9);
});

test('local provider LOMA helper never auto-files', async () => {
  const provider = new LocalCapabilityProvider();
  const result = await provider.execute({
    capability: 'gates.loma_lag_bfe',
    input: { lagFtNavd88: 377.2, bfeFtNavd88: 375.0 },
    context: { requestId: 'req-loma-1', permissions: { allow: [] } },
  });
  assert.equal(result.success, true);
  assert.equal((result.output as { autoFile: boolean }).autoFile, false);
  const freeboard = (result.output as { freeboardFt: number }).freeboardFt;
  assert.ok(Math.abs(freeboard - 2.2) < 1e-9);
});
