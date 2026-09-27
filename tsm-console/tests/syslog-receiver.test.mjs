import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { parseSyslog, acceptSyslog } from '../server/alerts/syslog.mjs';

test('parses RFC-style priority and severity', () => {
  const parsed = parseSyslog('<11>Sep 27 20:00:00 alert-host critical hydraulic warning');
  assert.equal(parsed.facility, 1);
  assert.equal(parsed.severity, 'CRITICAL');
  assert.equal(parsed.hostname, 'alert-host');
});

test('rejects unsigned syslog payloads', () => {
  process.env.TSM_ALERTMANAGER_HMAC_SECRET = 'test-secret';
  assert.throws(() => acceptSyslog('<11>Sep 27 20:00:00 alert-host critical hydraulic warning', ''), /ALERT_AUTHENTICATION_FAILED/);
});

test('accepts HMAC authenticated syslog payload', () => {
  process.env.TSM_ALERTMANAGER_HMAC_SECRET = 'test-secret';
  const raw = '<11>Sep 27 20:00:00 alert-host critical hydraulic warning';
  const signature = crypto.createHmac('sha256', 'test-secret').update(raw).digest('hex');
  const result = acceptSyslog(raw, `sha256=${signature}`);
  assert.equal(result.duplicate, false);
  assert.equal(result.severity, 'CRITICAL');
});
