import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createSign, generateKeyPairSync } from 'node:crypto';
import http from 'node:http';
import { authenticateRequest, requireAuthenticatedSubject, requireRoles, resetJwksCacheForTests } from './oidc-auth.mjs';
import { setSessionCookie } from './session-cookie.mjs';

function b64(value) { return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url'); }

test('OIDC verifier validates signature, issuer, audience, expiry and roles', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' });
  const kid = createHash('sha256').update(JSON.stringify(jwk)).digest('hex').slice(0, 16);
  const now = Math.floor(Date.now() / 1000);
  const issuer = 'http://127.0.0.1:19877/realms/tsm';
  const audience = 'tsm-console';
  const server = http.createServer((req, res) => {
    if (req.url !== '/jwks') return res.writeHead(404).end();
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ keys: [{ ...jwk, kid, alg: 'RS256', use: 'sig' }] }));
  });
  await new Promise((resolve) => server.listen(19877, '127.0.0.1', resolve));
  try {
    process.env.OIDC_ISSUER = issuer;
    process.env.OIDC_AUDIENCE = audience;
    process.env.OIDC_JWKS_URL = 'http://127.0.0.1:19877/jwks';
    process.env.TSM_AUTH_MODE = 'required';
    resetJwksCacheForTests();

    const header = { alg: 'RS256', typ: 'JWT', kid };
    const payload = { iss: issuer, aud: audience, sub: 'reviewer-123', exp: now + 300, iat: now, realm_access: { roles: ['tsm-reviewer'] } };
    const signingInput = b64(header) + '.' + b64(payload);
    const signer = createSign('RSA-SHA256');
    signer.update(signingInput);
    signer.end();
    const token = signingInput + '.' + signer.sign(privateKey).toString('base64url');

    const auth = await authenticateRequest({ headers: { authorization: 'Bearer ' + token } });
    assert.equal(auth.subject, 'reviewer-123');
    assert.deepEqual(auth.roles, ['tsm-reviewer']);
    requireRoles(auth, 'tsm-reviewer');
    requireAuthenticatedSubject(auth, 'reviewer-123');
    assert.throws(() => requireAuthenticatedSubject(auth, 'another-user'), /does not match/);

    process.env.TSM_SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
    const cookieResponse = { setHeader(name, value) { this[name] = value; }, getHeader(name) { return this[name]; } };
    setSessionCookie(cookieResponse, { accessToken: token, subject: auth.subject, roles: auth.roles, expiresAt: Date.now() + 300000 }, 300);
    const cookie = cookieResponse['Set-Cookie'].split(';', 1)[0];
    const cookieAuth = await authenticateRequest({ headers: { cookie } });
    assert.equal(cookieAuth.browserSession, true);
    assert.equal(cookieAuth.subject, 'reviewer-123');

    const badParts = token.split('.'); badParts[2] = (badParts[2][0] === 'A' ? 'B' : 'A') + badParts[2].slice(1); const badToken = badParts.join('.');
    await assert.rejects(() => authenticateRequest({ headers: { authorization: 'Bearer ' + badToken } }), /signature is invalid/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    delete process.env.OIDC_ISSUER;
    delete process.env.OIDC_AUDIENCE;
    delete process.env.OIDC_JWKS_URL;
    delete process.env.TSM_AUTH_MODE;
    delete process.env.TSM_SESSION_SECRET;
    resetJwksCacheForTests();
  }
});

test('OIDC verifier fails closed when required configuration is missing', async () => {
  delete process.env.OIDC_ISSUER;
  delete process.env.OIDC_AUDIENCE;
  delete process.env.OIDC_JWKS_URL;
  process.env.TSM_AUTH_MODE = 'required';
  await assert.rejects(() => authenticateRequest({ headers: {} }), /not configured/);
  delete process.env.TSM_AUTH_MODE;
});
