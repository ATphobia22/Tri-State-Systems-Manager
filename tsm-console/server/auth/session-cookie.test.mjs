import test from 'node:test';
import assert from 'node:assert/strict';
import { setSessionCookie, readSessionCookie, parseCookies } from './session-cookie.mjs';

test('OIDC session cookie is encrypted and round-trips', () => {
  process.env.TSM_SESSION_SECRET = 'test-secret-with-at-least-32-characters-long';
  process.env.TSM_AUTH_MODE = 'required';
  const headers = {};
  const response = { setHeader(name, value) { headers[name] = value; } };
  setSessionCookie(response, { accessToken: 'opaque-token', subject: 'subject-1', roles: ['tsm-operator'] }, 300);
  assert.match(headers['Set-Cookie'], /__Host-tsm_session=/);
  assert.match(headers['Set-Cookie'], /HttpOnly/);
  assert.match(headers['Set-Cookie'], /Secure/);
  assert.match(headers['Set-Cookie'], /SameSite=Lax/);
  const cookieValue = headers['Set-Cookie'].split(';', 1)[0];
  const request = { headers: { cookie: cookieValue } };
  assert.deepEqual(readSessionCookie(request), { accessToken: 'opaque-token', subject: 'subject-1', roles: ['tsm-operator'] });
  assert.deepEqual(parseCookies(request.headers.cookie)['__Host-tsm_session'], cookieValue.split('=')[1]);
});
