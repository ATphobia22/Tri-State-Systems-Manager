import test from 'node:test';
import assert from 'node:assert/strict';
import { getOsrmConfig, routeOsrm } from './osrm-client.mjs';

test('OSRM config is deterministic and bounded', () => {
  assert.deepEqual(getOsrmConfig({ TSM_OSRM_BASE_URL: 'http://osrm:5000/', TSM_OSRM_PROFILE: 'driving', TSM_OSRM_TIMEOUT_MS: '5000' }), { baseUrl: 'http://osrm:5000', profile: 'driving', timeoutMs: 5000 });
  assert.throws(() => getOsrmConfig({ TSM_OSRM_BASE_URL: 'file:///tmp/osrm' }), /must use http or https/);
});
test('OSRM rejects malformed coordinate payloads before network access', async () => {
  await assert.rejects(() => routeOsrm({ coordinates: [[181, 0], [0, 0]] }), /outside WGS84 bounds/);
  await assert.rejects(() => routeOsrm({ coordinates: [[0, 0]] }), /2-25 points/);
});
