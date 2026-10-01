import test from 'node:test';
import assert from 'node:assert/strict';
import { detectTelemetrySourceFailures } from '../server/alerts/telemetry-status.mjs';

test('telemetry source failure is converted to an explicit fail-closed alert', () => {
  const alerts = detectTelemetrySourceFailures({
    observed_at: '2026-10-01T21:00:00Z',
    payload: {
      station_id: '03378500',
      station_name: 'Wabash River at New Harmony, IN',
      status: 'SOURCE_UNAVAILABLE',
    },
  });

  assert.deepEqual(alerts, [{
    station_id: '03378500',
    station_name: 'Wabash River at New Harmony, IN',
    observed_at: '2026-10-01T21:00:00Z',
    alert_code: 'STATION_FAIL_CLOSED',
    status: 'SOURCE_UNAVAILABLE',
  }]);
});

test('normal telemetry produces no source-failure alert', () => {
  assert.deepEqual(
    detectTelemetrySourceFailures({ payload: { status: 'LIVE_OBSERVATION' } }),
    [],
  );
});
