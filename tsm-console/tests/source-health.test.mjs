import test from 'node:test';
import assert from 'node:assert/strict';
import { clearSourceHealth, recordSourceHealth, getSourceHealth, listSourceHealth } from '../server/ingestion/source-health.mjs';

test('source health records latency and counters without exposing mutable state', () => {
  clearSourceHealth();
  recordSourceHealth('USGS-NWIS-03378500', { ok: true, latencyMs: 42 });
  recordSourceHealth('USGS-NWIS-03378500', { ok: false, error: 'timeout', latencyMs: 100 });
  const state = getSourceHealth('USGS-NWIS-03378500');
  assert.equal(state.successCount, 1);
  assert.equal(state.errorCount, 1);
  assert.equal(state.lastLatencyMs, 100);
  const list = listSourceHealth();
  list[0].state = 'tampered';
  assert.equal(getSourceHealth('USGS-NWIS-03378500').state, 'degraded');
});
