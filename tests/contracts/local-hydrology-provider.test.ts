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
  assert.equal((ok.output as { wseNavd88Ft: number }).wseNavd88Ft, 356.85);
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
  assert.equal((result.output as { freeboardFt: number }).freeboardFt, 2.2);
});
