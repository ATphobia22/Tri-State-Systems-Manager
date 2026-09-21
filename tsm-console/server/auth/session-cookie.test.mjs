import test from 'node:test';
import assert from 'node:assert/strict';
import { setSessionCookie, readSessionCookie, parseCookies } from './session-cookie.mjs';

test('OIDC session cookie is encrypted and round-trips', () => {
  process.env.TSM_SESSION_SECRET = 'test-secret-with-at-least-32-characters-long';
  process.env.TSM_AUTH_MODE = 'required';
  const headers = {};
  const response = { setHeader(name, value) { headers[name] = value; }, getHeader(name) { return headers[name]; } };
  setSessionCookie(response, { accessToken: 'opaque-token', subject: 'subject-1', roles: ['tsm-operator'] }, 300);
  const sessionSetCookie = Array.isArray(headers['Set-Cookie']) ? headers['Set-Cookie'][0] : headers['Set-Cookie'];
  assert.match(sessionSetCookie, /__Host-tsm_session=/);
  assert.match(sessionSetCookie, /HttpOnly/);
  assert.match(sessionSetCookie, /Secure/);
  assert.match(sessionSetCookie, /SameSite=Lax/);
  const cookieValue = sessionSetCookie.split(';', 1)[0];
  const request = { headers: { cookie: cookieValue } };
  assert.deepEqual(readSessionCookie(request), { accessToken: 'opaque-token', subject: 'subject-1', roles: ['tsm-operator'] });
  assert.deepEqual(parseCookies(request.headers.cookie)['__Host-tsm_session'], cookieValue.split('=')[1]);
});
